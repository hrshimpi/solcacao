import { requestReference } from "./requestReference";

describe("requestReference", () => {
  it("is SC- and the last eight characters of the id, in capitals", () => {
    expect(requestReference("66a1b2c3d4e5f60718293a4b")).toBe("SC-18293A4B");
  });

  it("is the same for the same request every time", () => {
    expect(requestReference("66a1b2c3d4e5f60718293a4b")).toBe(requestReference("66a1b2c3d4e5f60718293a4b"));
  });

  it("is different for ids that end differently", () => {
    expect(requestReference("66a1b2c3d4e5f60718293a4b")).not.toBe(requestReference("66a1b2c3d4e5f60718293a4c"));
  });

  it("keeps a short id as it is", () => {
    expect(requestReference("ab12")).toBe("SC-AB12");
  });
});
