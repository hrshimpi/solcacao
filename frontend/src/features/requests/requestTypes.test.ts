import { isKnownStatus, parseRequestList } from "./requestTypes";

const full = {
  id: "66a1b2c3d4e5f60718293a4b",
  userId: "66a1b2c3d4e5f60718290000",
  companyName: "Hacienda Brands",
  contactName: "Isabel Vasquez",
  cacaoProfile: "Ecuador 72%",
  packagingType: "rigid_box",
  quantityEstimate: 800,
  notes: "Gold foil",
  brandAssets: [{ originalName: "logo.png", storedName: "abc.png", mimeType: "image/png", sizeBytes: 70, uploadedAt: "2026-10-26T12:00:00.000Z" }],
  status: "quoted",
  quoteAmount: 125000,
  quoteNote: "Includes shipping.",
  createdAt: "2026-10-26T12:00:00.000Z",
  updatedAt: "2026-10-26T12:00:00.000Z",
};

describe("parseRequestList", () => {
  it("reads a request as the API sends it, and keeps only what the page uses", () => {
    const parsed = parseRequestList({ items: [full], page: 1, limit: 100, total: 1, totalPages: 1 });

    expect(parsed).toEqual({
      total: 1,
      items: [
        {
          id: "66a1b2c3d4e5f60718293a4b",
          companyName: "Hacienda Brands",
          contactName: "Isabel Vasquez",
          cacaoProfile: "Ecuador 72%",
          packagingType: "rigid_box",
          quantityEstimate: 800,
          notes: "Gold foil",
          brandAssets: [{ originalName: "logo.png", storedName: "abc.png", mimeType: "image/png", sizeBytes: 70 }],
          status: "quoted",
          quoteAmount: 125000,
          quoteNote: "Includes shipping.",
          createdAt: "2026-10-26T12:00:00.000Z",
        },
      ],
    });
  });

  it("reads an empty list", () => {
    expect(parseRequestList({ items: [], total: 0 })).toEqual({ items: [], total: 0 });
  });

  it.each([
    ["nothing", undefined],
    ["null", null],
    ["text", "nope"],
    ["a list", []],
    ["an object without items", { requests: [] }],
    ["items that is not a list", { items: "x" }],
  ])("is null for %s", (_label, data) => {
    expect(parseRequestList(data)).toBeNull();
  });

  it("leaves out an item that has no id, or is not an object", () => {
    const parsed = parseRequestList({ items: [null, 5, "x", {}, { id: "" }, { id: 7 }, full] });

    expect(parsed?.items.map((item) => item.id)).toEqual([full.id]);
  });

  it("turns missing or wrong fields into empty ones", () => {
    const parsed = parseRequestList({
      items: [{ id: "abc", companyName: 5, quantityEstimate: "800", notes: null, brandAssets: "none", quoteAmount: "free", status: 3, createdAt: {} }],
    });

    expect(parsed?.items[0]).toEqual({
      id: "abc",
      companyName: "",
      contactName: "",
      cacaoProfile: "",
      packagingType: "",
      quantityEstimate: 0,
      notes: "",
      brandAssets: [],
      status: "submitted",
      quoteAmount: null,
      quoteNote: "",
      createdAt: "",
    });
  });

  it("keeps only the files that have a name and a stored name", () => {
    const parsed = parseRequestList({
      items: [{ id: "abc", brandAssets: [{ originalName: "a.pdf", storedName: "1.pdf" }, { originalName: "b.pdf" }, null, { storedName: "3.pdf" }] }],
    });

    expect(parsed?.items[0].brandAssets).toEqual([{ originalName: "a.pdf", storedName: "1.pdf", mimeType: "", sizeBytes: 0 }]);
  });

  it("keeps the amount of a quote of any size, also zero, but not a number that is not finite", () => {
    const parsed = parseRequestList({ items: [{ id: "a", quoteAmount: 0 }, { id: "b", quoteAmount: 99 }, { id: "c", quoteAmount: Infinity }] });

    expect(parsed?.items.map((item) => item.quoteAmount)).toEqual([0, 99, null]);
  });

  it("uses the total of the server when it is at least the number of items, and the number of items otherwise", () => {
    expect(parseRequestList({ items: [full], total: 130 })?.total).toBe(130);
    expect(parseRequestList({ items: [full, { ...full, id: "b" }], total: 1 })?.total).toBe(2);
    expect(parseRequestList({ items: [full] })?.total).toBe(1);
    expect(parseRequestList({ items: [full], total: "many" })?.total).toBe(1);
  });

  it("keeps a status that it does not know as it was sent", () => {
    expect(parseRequestList({ items: [{ id: "a", status: "on_hold" }] })?.items[0].status).toBe("on_hold");
  });
});

describe("isKnownStatus", () => {
  it.each(["submitted", "quoted", "approved", "rejected"])("knows %s", (status) => {
    expect(isKnownStatus(status)).toBe(true);
  });

  it.each(["", "on_hold", "Quoted", "constructor", "__proto__"])("does not know %j", (status) => {
    expect(isKnownStatus(status)).toBe(false);
  });
});
