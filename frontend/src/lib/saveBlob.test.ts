import { saveBlob } from "./saveBlob";

describe("saveBlob", () => {
  let created: string[];
  let revoked: string[];
  let clicked: { href: string; download: string }[];

  beforeEach(() => {
    created = [];
    revoked = [];
    clicked = [];
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      created.push(String((blob as Blob).size));
      return "blob:http://localhost/abc";
    });
    URL.revokeObjectURL = vi.fn((url: string) => {
      revoked.push(url);
    });
    // jsdom does not navigate, so a click on the link is only written down
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clicks a link to the blob that saves it under the given name", () => {
    saveBlob(new Blob(["hello"]), "brand guide.pdf");

    expect(created).toEqual(["5"]);
    expect(clicked).toEqual([{ href: "blob:http://localhost/abc", download: "brand guide.pdf" }]);
  });

  it("leaves no link behind in the page", () => {
    saveBlob(new Blob(["x"]), "a.png");

    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("lets the blob go a little later, not before the browser has started to read it", () => {
    saveBlob(new Blob(["x"]), "a.png");
    expect(revoked).toEqual([]);

    vi.advanceTimersByTime(10_000);

    expect(revoked).toEqual(["blob:http://localhost/abc"]);
  });
});
