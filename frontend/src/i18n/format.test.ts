import { formatCents, formatDate, formatNumber, formatPrice } from "./format";

describe("formatCents", () => {
  it("writes whole cents as dollars", () => {
    expect(formatCents(125000, "en")).toBe("$1,250.00");
    expect(formatCents(1, "en")).toBe("$0.01");
    expect(formatCents(99, "en")).toBe("$0.99");
  });

  it("is the same amount as formatPrice with the dollars", () => {
    expect(formatCents(125000, "es")).toBe(formatPrice(1250, "es"));
  });

  it("follows the language", () => {
    expect(formatCents(123456789, "en")).toBe("$1,234,567.89");
    expect(formatCents(123456789, "es")).toContain("1,234,567.89");
  });
});

describe("formatNumber", () => {
  it("groups the digits for the language", () => {
    expect(formatNumber(800, "en")).toBe("800");
    expect(formatNumber(12000, "en")).toBe("12,000");
    expect(formatNumber(10_000_000, "es")).toBe("10,000,000");
  });
});

describe("formatDate", () => {
  // noon in UTC, so the day is the same in almost every time zone
  it("writes a moment as a short date in the language", () => {
    expect(formatDate("2026-10-26T12:00:00.000Z", "en")).toBe("Oct 26, 2026");
    expect(formatDate("2026-10-26T12:00:00.000Z", "es")).toMatch(/26 oct 2026|oct 26, 2026/i);
  });

  it.each(["", "not a date", "2026-13-45"])("gives nothing for %j", (value) => {
    expect(formatDate(value, "en")).toBe("");
  });
});
