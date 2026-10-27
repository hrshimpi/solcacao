import { loginWithNext, safeNextPath, withoutLanguage } from "./nextPath";

describe("withoutLanguage", () => {
  it("takes the language off the front", () => {
    expect(withoutLanguage("/en/wholesale/studio")).toBe("/wholesale/studio");
    expect(withoutLanguage("/es/wholesale/studio")).toBe("/wholesale/studio");
  });

  it("leaves / for the home page", () => {
    expect(withoutLanguage("/en")).toBe("/");
    expect(withoutLanguage("/es")).toBe("/");
  });

  it("only takes off a whole language, not the start of a longer word", () => {
    expect(withoutLanguage("/english/page")).toBe("/english/page");
    expect(withoutLanguage("/wholesale/en")).toBe("/wholesale/en");
  });
});

describe("safeNextPath", () => {
  it.each(["/wholesale/studio", "/", "/shop?category=bar", "/shop/ecuador-72", "/profile#top", "/wholesale/studio?step=2"])("accepts the page %s", (value) => {
    expect(safeNextPath(value)).toBe(value);
  });

  it.each([null, ""])("gives null for %j", (value) => {
    expect(safeNextPath(value)).toBeNull();
  });

  it.each([
    "//evil.example",
    "//evil.example/wholesale/studio",
    "/\\evil.example",
    "\\\\evil.example",
    "https://evil.example",
    "http://evil.example/wholesale/studio",
    "javascript:alert(1)",
    "evil.example",
    "wholesale/studio",
    "/wholesale\\studio",
    "/wholesale/studio\r\nSet-Cookie: x=1",
    "/wholesale/\tstudio",
  ])("refuses %j, which could leave the site", (value) => {
    expect(safeNextPath(value)).toBeNull();
  });

  it("refuses the sign in page itself, so nobody is sent in a circle", () => {
    expect(safeNextPath("/account/login")).toBeNull();
    expect(safeNextPath("/account/login?next=%2Fshop")).toBeNull();
    expect(safeNextPath("/account/login/")).toBeNull();
    expect(safeNextPath("/account/register")).toBe("/account/register");
    expect(safeNextPath("/account/login-help")).toBe("/account/login-help");
  });
});

describe("loginWithNext", () => {
  it("puts the page in the sign in address, written so that it survives the address bar", () => {
    expect(loginWithNext("/wholesale/studio")).toBe("/account/login?next=%2Fwholesale%2Fstudio");
    expect(loginWithNext("/shop?category=bar&min=55")).toBe("/account/login?next=%2Fshop%3Fcategory%3Dbar%26min%3D55");
  });

  it("makes an address that safeNextPath reads back", () => {
    for (const next of ["/wholesale/studio", "/shop?category=bar&min=55", "/profile#top"]) {
      const value = new URL(loginWithNext(next), "http://localhost").searchParams.get("next");
      expect(safeNextPath(value)).toBe(next);
    }
  });
});
