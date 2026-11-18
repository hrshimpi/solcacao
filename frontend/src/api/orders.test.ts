import { readOrder } from "./orders";

describe("reading an order of the server", () => {
  const good = {
    id: "64b7f0c2a1b2c3d4e5f60001",
    number: "SC-E5F60001",
    status: "paid",
    nextStatuses: ["processing", "cancelled"],
    canCancel: true,
    createdAt: "2026-11-10T15:00:00.000Z",
    lines: [{ kind: "product", quantity: 2, unitPrice: 1200, lineTotal: 2400, products: [{ id: "a", slug: "ecuador-72", name: "Ecuador 72%", thumbnail: "https://images.example.com/a.jpg", imageAlt: "A bar" }] }],
    shippingAddress: { fullName: "Isabel", phone: null, label: "Home", street: "12 Cacao Lane", street2: null, city: "Arlington", state: "TX", postalCode: "76010", country: "United States" },
    shippingMethod: "standard",
    totals: { subtotal: 2400, shipping: 595, tax: 198, total: 3193 },
    payment: { method: "card", brand: "visa", last4: "4242", reference: "demo_1", status: "paid" },
    note: null,
    history: [{ status: "paid", at: "2026-11-10T15:00:00.000Z" }],
    customer: { id: "u", email: "isabel@example.com", name: "Isabel" },
  };

  it("turns cents into dollars and keeps the rest", () => {
    const order = readOrder(good)!;

    expect(order.totals).toEqual({ subtotal: 24, shipping: 5.95, tax: 1.98, total: 31.93 });
    expect(order.lines[0]).toMatchObject({ unitPrice: 12, lineTotal: 24, quantity: 2 });
    expect(order.itemCount).toBe(2);
    expect(order.payment).toEqual({ brand: "visa", last4: "4242", status: "paid" });
  });

  it("refuses what is not an order: a wrong number, a status that does not exist, no lines, no totals", () => {
    for (const change of [{ number: "SC-1" }, { status: "lost" }, { lines: [] }, { totals: { subtotal: "24" } }, { shippingMethod: "teleport" }, { shippingAddress: null }]) {
      expect(readOrder({ ...good, ...change }), JSON.stringify(change)).toBeNull();
    }
    expect(readOrder(null)).toBeNull();
    expect(readOrder("order")).toBeNull();
  });

  it("leaves out a line that is not valid, and a step of the history that is not valid", () => {
    const order = readOrder({ ...good, lines: [good.lines[0], { kind: "product", quantity: 0 }], history: [good.history[0], { status: "lost", at: "now" }] })!;

    expect(order.lines).toHaveLength(1);
    expect(order.history).toHaveLength(1);
  });
});
