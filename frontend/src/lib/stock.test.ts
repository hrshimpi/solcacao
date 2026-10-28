import { LOW_STOCK_THRESHOLD, stockStatus } from "./stock";

describe("stockStatus", () => {
  it("says out when nothing is left", () => {
    expect(stockStatus(0)).toBe("out");
    expect(stockStatus(-3)).toBe("out");
  });

  it("says low at the threshold and below", () => {
    expect(stockStatus(1)).toBe("low");
    expect(stockStatus(LOW_STOCK_THRESHOLD)).toBe("low");
  });

  it("says in stock above the threshold", () => {
    expect(stockStatus(LOW_STOCK_THRESHOLD + 1)).toBe("in_stock");
  });

  it("takes a different threshold", () => {
    expect(stockStatus(4, 3)).toBe("in_stock");
    expect(stockStatus(3, 3)).toBe("low");
  });
});