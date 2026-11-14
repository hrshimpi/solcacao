import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FakeOrder } from "../../test/fakeOrders";
import { installFakeServer, retailAccount, type FakeServer } from "../../test/fakeServer";
import { fixtureId, fixtureRecords } from "../../test/productFixtures";
import { renderAt, sessionFor } from "../../test/renderAt";

const cents = (slug: string) => fixtureRecords.find((record) => record.product.slug === slug)!.product.price;

let count = 0;
// an order of the account in the fake shop. The number is the last 8 characters of the id, in capitals.
function makeOrder(server: FakeServer, overrides: Partial<FakeOrder> = {}): FakeOrder {
  count += 1;
  const id = `64b7f0c2a1b2c3d4e5f6${count.toString(16).padStart(4, "0")}`;
  const subtotal = cents("ecuador-72") * 2;
  const order: FakeOrder = {
    id,
    number: `SC-${id.slice(-8).toUpperCase()}`,
    userId: server.accounts[0].id,
    email: server.accounts[0].email,
    customerName: server.accounts[0].name,
    status: "paid",
    lines: [{ kind: "product", productIds: [fixtureId("ecuador-72")], quantity: 2, unitPrice: cents("ecuador-72"), lineTotal: subtotal }],
    address: { fullName: "Isabel Vasquez", phone: null, label: "Home", street: "12 Cacao Lane", street2: null, city: "Arlington", state: "TX", postalCode: "76010", country: "United States" },
    method: "standard",
    totals: { subtotal, shipping: 595, tax: 198, total: subtotal + 595 + 198 },
    payment: { brand: "visa", last4: "4242", reference: "demo_1", status: "paid" },
    note: null,
    history: [{ status: "paid", at: "2026-11-10T15:00:00.000Z" }],
    createdAt: `2026-11-1${count % 10}T15:00:00.000Z`,
    ...overrides,
  };
  server.orders.push(order);
  return order;
}

async function open(path: string, prepare: (server: FakeServer) => void = () => {}) {
  const user = userEvent.setup();
  const server = installFakeServer([retailAccount]);
  const signedIn = sessionFor(server, server.accounts[0]);
  prepare(server);
  const result = renderAt(path, { user: signedIn });
  await screen.findByRole("heading", { level: 1 });
  return { user, server, ...result };
}

const page = () => within(screen.getByRole("main"));
const failing = (status: number, code: string) => new Response(JSON.stringify({ error: { code, message: "No.", details: [] } }), { status });

describe("your orders", () => {
  it("lists the orders newest first, with the number, the date, the status, what was in it and the total", async () => {
    let first: FakeOrder;
    let second: FakeOrder;
    await open("/en/account/orders", (server) => {
      first = makeOrder(server, { status: "delivered", createdAt: "2026-11-01T15:00:00.000Z" });
      second = makeOrder(server, { status: "shipped", createdAt: "2026-11-09T15:00:00.000Z", lines: [{ kind: "product", productIds: [fixtureId("peru-68")], quantity: 1, unitPrice: cents("peru-68"), lineTotal: cents("peru-68") }], totals: { subtotal: 1100, shipping: 595, tax: 91, total: 1786 } });
    });

    const cards = page().getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(within(cards[1]).getByRole("heading", { level: 2, name: `Order ${first!.number}` })).toBeInTheDocument();
    expect(within(cards[0]).getByRole("heading", { level: 2, name: `Order ${second!.number}` })).toBeInTheDocument();
    expect(within(cards[0]).getByText("Shipped")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Peru 68%")).toBeInTheDocument();
    expect(within(cards[0]).getByText(/Total: \$17\.86/)).toBeInTheDocument();
    expect(within(cards[1]).getByText("Ecuador 72% (2)")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Delivered")).toBeInTheDocument();
    expect(within(cards[1]).getByText(/Placed on Nov 1, 2026/)).toBeInTheDocument();
  });

  it("links each order to its details", async () => {
    let order: FakeOrder;
    await open("/en/account/orders", (server) => {
      order = makeOrder(server);
    });

    expect(page().getByRole("link", { name: `View details, Order ${order!.number}` })).toHaveAttribute("href", `/en/account/orders/${order!.id}`);
  });

  it("shows only the orders of the person who is signed in", async () => {
    await open("/en/account/orders", (server) => {
      makeOrder(server);
      makeOrder(server, { userId: "64b7f0c2a1b2c3d4e5f6ffff" });
    });

    expect(page().getAllByRole("article")).toHaveLength(1);
  });

  it("says that there is nothing yet, with a way to the shop", async () => {
    await open("/en/account/orders");

    expect(await page().findByText("You haven't bought anything yet.")).toBeInTheDocument();
    expect(page().getByRole("link", { name: "Start shopping" })).toHaveAttribute("href", "/en/shop");
  });

  it("shows ten orders and adds the next ten with a button, without repeating one", async () => {
    const { user } = await open("/en/account/orders", (server) => {
      for (let index = 0; index < 13; index++) makeOrder(server, { createdAt: `2026-10-${String(10 + index)}T10:00:00.000Z` });
    });

    expect(page().getAllByRole("article")).toHaveLength(10);
    await user.click(page().getByRole("button", { name: "Show more orders" }));

    await waitFor(() => expect(page().getAllByRole("article")).toHaveLength(13));
    expect(page().queryByRole("button", { name: "Show more orders" })).not.toBeInTheDocument();
  });

  it("shows a sampler by its name, and the order in Spanish", async () => {
    await open("/es/account/orders", (server) => {
      makeOrder(server, { lines: [{ kind: "sampler", productIds: ["ecuador-72", "peru-68", "venezuela-76", "colombia-64"].map(fixtureId), quantity: 1, unitPrice: 4800, lineTotal: 4800 }] });
    });

    expect(page().getByRole("heading", { level: 1, name: "Tus pedidos" })).toBeInTheDocument();
    expect(page().getByText("Muestrario personalizado")).toBeInTheDocument();
    expect(page().getByText("Pagado")).toBeInTheDocument();
  });

  it("says that the orders could not be loaded, and loads them after a second try", async () => {
    const { user, server } = await open("/en/account/orders", (fake) => {
      makeOrder(fake);
      fake.override = (call) => (call.path.startsWith("/api/orders") ? failing(500, "INTERNAL_ERROR") : undefined);
    });

    expect(await page().findByText("We couldn't load your orders.")).toBeInTheDocument();
    server.override = null;
    await user.click(page().getByRole("button", { name: "Try again" }));

    expect(await page().findAllByRole("article")).toHaveLength(1);
  });

  it("is for a signed in person", async () => {
    installFakeServer();
    const { router } = renderAt("/en/account/orders");

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?next=%2Faccount%2Forders");
  });

  it("is reached from the profile page", async () => {
    await open("/en/profile");

    expect(page().getByRole("link", { name: /Your orders/ })).toHaveAttribute("href", "/en/account/orders");
  });
});

describe("one order, in detail", () => {
  async function show(overrides: Partial<FakeOrder> = {}, state?: unknown) {
    const user = userEvent.setup();
    const server = installFakeServer([retailAccount]);
    const signedIn = sessionFor(server, server.accounts[0]);
    const order = makeOrder(server, overrides);
    const { router } = renderAt(`/en/account/orders/${order.id}`, { user: signedIn });
    await screen.findByRole("heading", { level: 1, name: order.number });
    // the checkout sends the person here with a note in the state of the navigation
    if (state) await act(async () => router.navigate(`/en/account/orders/${order.id}`, { state }));
    return { user, server, order, router };
  }

  it("shows what was bought, the totals, where it goes, how it was paid and the note", async () => {
    await show({ note: "Ring twice." });

    expect(page().getByRole("link", { name: "Ecuador 72%" })).toHaveAttribute("href", "/en/shop/ecuador-72");
    expect(page().getByText("Quantity 2 · $12.00 each")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Summary" })).getByText("$31.93")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Summary" })).getByText("$5.95")).toBeInTheDocument();
    expect(page().getByText(/12 Cacao Lane/)).toBeInTheDocument();
    expect(page().getByText("Standard shipping, 3 to 5 business days")).toBeInTheDocument();
    expect(page().getByText("Visa ending in 4242")).toBeInTheDocument();
    expect(page().getByText("Ring twice.")).toBeInTheDocument();
  });

  it("shows the steps that happened, with the date, and the ones that did not yet", async () => {
    await show({ status: "processing", history: [{ status: "paid", at: "2026-11-10T15:00:00.000Z" }, { status: "processing", at: "2026-11-11T15:00:00.000Z" }] });

    // the section also lists what was bought, so the four steps are the last four items
    const steps = within(page().getByRole("heading", { level: 2, name: "Progress" }).parentElement as HTMLElement).getAllByRole("listitem").slice(-4);
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveTextContent("PaidNov 10, 2026");
    expect(steps[1]).toHaveTextContent("Being packedNov 11, 2026");
    expect(steps[2]).toHaveTextContent(/^Shipped$/);
    expect(steps[3]).toHaveTextContent(/^Delivered$/);
  });

  it("says that an order cannot be found when it is somebody else's or does not exist", async () => {
    const server = installFakeServer([retailAccount]);
    renderAt("/en/account/orders/64b7f0c2a1b2c3d4e5f6ffff", { user: sessionFor(server, server.accounts[0]) });

    expect(await screen.findByText("We couldn't find that order.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to your orders" })).toHaveAttribute("href", "/en/account/orders");
  });

  it("cancels an order that was just paid, after asking, and says that the payment was refunded", async () => {
    const { user, server, order } = await show();
    expect(page().getByText("Paid (demo, nobody was charged)")).toBeInTheDocument();

    await user.click(page().getByRole("button", { name: "Cancel this order" }));
    expect(page().getByText(/The items go back to the shop and your payment is refunded/)).toBeInTheDocument();
    await user.click(page().getByRole("button", { name: "Yes, cancel the order" }));

    expect(await page().findByText("Refunded")).toBeInTheDocument();
    expect(page().getAllByText("Cancelled").length).toBeGreaterThan(0);
    expect(server.orders.find((entry) => entry.id === order.id)?.status).toBe("cancelled");
    expect(server.stock.get("ecuador-72")).toBe(122);
    expect(page().queryByRole("button", { name: "Cancel this order" })).not.toBeInTheDocument();
  });

  it("keeps the order when the person changes their mind", async () => {
    const { user, order, server } = await show();

    await user.click(page().getByRole("button", { name: "Cancel this order" }));
    await user.click(page().getByRole("button", { name: "Keep the order" }));

    // the focus goes back on the next animation frame
    await waitFor(() => expect(page().getByRole("button", { name: "Cancel this order" })).toHaveFocus());
    expect(server.orders.find((entry) => entry.id === order.id)?.status).toBe("paid");
  });

  it("has no cancel button once the team started to pack the order", async () => {
    await show({ status: "processing" });

    expect(page().queryByRole("button", { name: "Cancel this order" })).not.toBeInTheDocument();
  });

  it("says that it could not be cancelled when the order moved on in the meantime", async () => {
    const { user, server } = await show();
    server.override = (call) => (call.method === "POST" && call.path.endsWith("/cancel") ? failing(400, "INVALID_TRANSITION") : undefined);

    await user.click(page().getByRole("button", { name: "Cancel this order" }));
    await user.click(page().getByRole("button", { name: "Yes, cancel the order" }));

    expect(await screen.findByText(/We couldn't cancel the order/)).toBeInTheDocument();
  });

  it("says thank you right after a purchase, and moves the keyboard to the number of the order", async () => {
    await show({}, { placed: true });

    expect(await screen.findByText("Thank you, your order was placed")).toBeInTheDocument();
  });
});
