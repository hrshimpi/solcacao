import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFakeServer, retailAccount, type FakeAddress, type FakeCartLine, type FakeServer } from "../../test/fakeServer";
import { fixtureId, fixtureRecords } from "../../test/productFixtures";
import { renderAt, sessionFor } from "../../test/renderAt";

const home: FakeAddress = { id: "64b7f0c2a1b2c3d4e5f60901", label: "Home", street: "12 Cacao Lane", city: "Arlington", state: "TX", postalCode: "76010", country: "United States", isDefault: true };
const office: FakeAddress = { id: "64b7f0c2a1b2c3d4e5f60902", label: "Office", street: "500 Main St", street2: "Suite 4", city: "Dallas", state: "TX", postalCode: "75201", country: "United States", isDefault: false };

const cents = (slug: string) => fixtureRecords.find((record) => record.product.slug === slug)!.product.price;
const line = (slug: string, quantity: number): FakeCartLine => ({ lineId: `p-${fixtureId(slug)}`, kind: "product", productIds: [fixtureId(slug)], quantity, unitPrice: cents(slug) });
const dollars = (value: number) => `$${(value / 100).toFixed(2)}`;

interface Options {
  addresses?: FakeAddress[];
  lines?: FakeCartLine[];
  path?: string;
  prepare?: (server: FakeServer) => void;
}

// the person is signed in, has these addresses and has this in the cart (on the server)
async function openCheckout({ addresses = [home, office], lines = [line("ecuador-72", 2)], path = "/en/checkout", prepare }: Options = {}) {
  const user = userEvent.setup();
  const server = installFakeServer([retailAccount]);
  server.addresses = addresses.map((address) => ({ ...address }));
  const account = server.accounts[0];
  const signedIn = sessionFor(server, account);
  server.carts.set(`user:${account.id}`, lines);
  prepare?.(server);
  const result = renderAt(path, { user: signedIn });
  await screen.findByRole("heading", { level: 1, name: /^(Checkout|Pago)$/ });
  return { user, server, account, ...result };
}

// the card fields are in the form of the page. The addresses and the ways to ship are beside it, not inside it (a form cannot be inside a form)
const form = () => within(document.getElementById("checkout-form") as HTMLElement);
const page = () => within(screen.getByRole("main"));
const summary = () => within(screen.getByRole("complementary", { name: /Your order|Tu pedido/ }));

async function payWith(user: ReturnType<typeof userEvent.setup>, card: { number?: string; expiry?: string; cvc?: string; name?: string } = {}) {
  const all = { number: "4242424242424242", expiry: "1230", cvc: "123", name: "Isabel Vasquez", ...card };
  await user.type(form().getByLabelText(/Name on card/), all.name);
  await user.type(form().getByLabelText(/Card number/), all.number);
  await user.type(form().getByLabelText(/Expiry date/), all.expiry);
  await user.type(form().getByLabelText(/Security code/), all.cvc);
}

const placeButton = () => summary().getByRole("button", { name: /^Place order/ });
const failing = (status: number, code: string, details: unknown[] = []) => new Response(JSON.stringify({ error: { code, message: "No.", details } }), { status });

describe("the checkout: what it shows", () => {
  it("shows the three steps and the summary with the totals of the server", async () => {
    await openCheckout();

    expect(screen.getByRole("heading", { level: 2, name: /Shipping address/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /^Delivery/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /^Payment/ })).toBeInTheDocument();
    expect(summary().getByText("Ecuador 72%")).toBeInTheDocument();
    expect(summary().getByText("2 items")).toBeInTheDocument();
    // two bars of $12.00: shipping $5.95, tax 8.25% of $24.00 is $1.98
    expect(summary().getByText("$24.00", { selector: "dd" })).toBeInTheDocument();
    expect(summary().getByText("$5.95")).toBeInTheDocument();
    expect(summary().getByText("$1.98")).toBeInTheDocument();
    expect(placeButton()).toHaveTextContent("$31.93");
  });

  it("says in words that the payment is made up", async () => {
    await openCheckout();

    expect(screen.getByText(/This is a demo shop\. No real payment is made/)).toBeInTheDocument();
    expect(screen.getByText(/Use the test card 4242 4242 4242 4242/)).toBeInTheDocument();
  });

  it("chooses the default address to begin with, and lets the person choose another", async () => {
    const { user } = await openCheckout();

    expect(await page().findByRole("radio", { name: /Home/ })).toBeChecked();
    expect(page().getByRole("radio", { name: /Office/ })).not.toBeChecked();

    await user.click(page().getByRole("radio", { name: /Office/ }));

    expect(page().getByRole("radio", { name: /Office/ })).toBeChecked();
  });

  it("changes the shipping and the total when express is chosen", async () => {
    const { user } = await openCheckout();

    await user.click(page().getByRole("radio", { name: /Express shipping/ }));

    expect(summary().getByText("$14.95")).toBeInTheDocument();
    expect(placeButton()).toHaveTextContent(dollars(2400 + 1495 + 198));
  });

  it("shows free shipping from $60.00", async () => {
    await openCheckout({ lines: [line("midnight-truffle", 4)] });

    expect(summary().getAllByText("Free").length).toBeGreaterThan(0);
    expect(page().getByRole("radio", { name: /Standard shipping/ })).toHaveAccessibleName(/Free/);
  });

  it("is in Spanish on the Spanish page", async () => {
    await openCheckout({ path: "/es/checkout" });

    expect(screen.getByRole("heading", { level: 2, name: /Dirección de envío/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Hacer el pedido/ })).toBeInTheDocument();
  });
});

describe("the checkout: who can open it", () => {
  it("sends somebody who is not signed in to sign in, and brings them back", async () => {
    installFakeServer();
    const { router } = renderAt("/en/checkout");

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?next=%2Fcheckout");
  });

  it("says that the cart is empty, with a way to the shop, instead of the steps", async () => {
    await openCheckout({ lines: [] }).catch(() => undefined);

    expect(await screen.findByRole("heading", { level: 1, name: "Your cart is empty" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse the shop" })).toHaveAttribute("href", "/en/shop");
    expect(screen.queryByRole("button", { name: /^Place order/ })).not.toBeInTheDocument();
  });
});

describe("the checkout: placing the order", () => {
  it("makes the order, empties the cart, takes the stock and shows the order with a thank you", async () => {
    const { user, server } = await openCheckout();
    await page().findByRole("radio", { name: /Home/ });
    await payWith(user);

    await user.click(placeButton());

    expect(await screen.findByRole("heading", { level: 1, name: /^SC-[0-9A-F]{8}$/ })).toBeInTheDocument();
    expect(screen.getByText("Thank you, your order was placed")).toBeInTheDocument();
    expect(server.orders).toHaveLength(1);
    expect(server.orders[0]).toMatchObject({ method: "standard", totals: { total: 3193 }, payment: { brand: "visa", last4: "4242" } });
    expect(server.stock.get("ecuador-72")).toBe(118);
    expect(server.carts.get(`user:${server.accounts[0].id}`)).toEqual([]);
    expect(await screen.findByRole("button", { name: "Cart, empty" })).toBeInTheDocument();
  });

  it("sends the card without spaces, and the address and the way of shipping that were chosen", async () => {
    const { user, server } = await openCheckout();
    await page().findByRole("radio", { name: /Home/ });
    await user.click(page().getByRole("radio", { name: /Office/ }));
    await user.click(page().getByRole("radio", { name: /Express shipping/ }));
    await user.type(form().getByLabelText(/Delivery note/), "Leave it with the neighbor.");
    await payWith(user);

    await user.click(placeButton());

    await screen.findByRole("heading", { level: 1, name: /^SC-/ });
    expect(server.callsTo("POST", "/api/orders")[0].body).toEqual({
      addressId: office.id,
      shippingMethod: "express",
      payment: { cardNumber: "4242424242424242", expiry: "12/30", cvc: "123", nameOnCard: "Isabel Vasquez" },
      note: "Leave it with the neighbor.",
    });
  });

  it("never sends a price or a total", async () => {
    const { user, server } = await openCheckout();
    await page().findByRole("radio", { name: /Home/ });
    await payWith(user);

    await user.click(placeButton());
    await screen.findByRole("heading", { level: 1, name: /^SC-/ });

    const text = JSON.stringify(server.callsTo("POST", "/api/orders")[0].body);
    expect(text).not.toMatch(/total|price|subtotal/i);
  });

  it("shows on the card number that the card was declined, and makes no order", async () => {
    const { user, server } = await openCheckout();
    await page().findByRole("radio", { name: /Home/ });
    await payWith(user, { number: "4000000000000002" });

    await user.click(placeButton());

    const number = await form().findByLabelText(/Card number/);
    await waitFor(() => expect(number).toHaveAttribute("aria-invalid", "true"));
    expect(number).toHaveAccessibleDescription("Your card was declined. Please try another card.");
    expect(number).toHaveFocus();
    expect(server.orders).toHaveLength(0);
    expect(server.stock.get("ecuador-72")).toBe(120);
  });

  it("says when there is not enough money on the card", async () => {
    const { user } = await openCheckout();
    await page().findByRole("radio", { name: /Home/ });
    await payWith(user, { number: "4000000000009995" });

    await user.click(placeButton());

    expect(await form().findByLabelText(/Card number/)).toHaveAccessibleDescription("There isn't enough money on that card.");
  });

  it("lets the person try another card after a refusal", async () => {
    const { user, server } = await openCheckout();
    await page().findByRole("radio", { name: /Home/ });
    await payWith(user, { number: "4000000000000002" });
    await user.click(placeButton());
    await waitFor(() => expect(form().getByLabelText(/Card number/)).toHaveAttribute("aria-invalid", "true"));

    await user.clear(form().getByLabelText(/Card number/));
    await user.type(form().getByLabelText(/Card number/), "4242424242424242");
    await user.click(placeButton());

    expect(await screen.findByRole("heading", { level: 1, name: /^SC-/ })).toBeInTheDocument();
    expect(server.orders).toHaveLength(1);
  });

  it("checks the card before it asks the server: a wrong number, a date that passed, an empty code", async () => {
    const { user, server } = await openCheckout();
    await page().findByRole("radio", { name: /Home/ });
    await payWith(user, { number: "4242424242424241", expiry: "0120", cvc: "1" });

    await user.click(placeButton());

    expect(form().getByLabelText(/Card number/)).toHaveAccessibleDescription("Enter a valid card number.");
    expect(form().getByLabelText(/Expiry date/)).toHaveAccessibleDescription(/Enter a date that has not passed/);
    expect(form().getByLabelText(/Security code/)).toHaveAccessibleDescription("Enter the 3 or 4 digit code.");
    expect(server.callsTo("POST", "/api/orders")).toHaveLength(0);
  });

  it("asks for the name on the card too", async () => {
    const { user } = await openCheckout();
    await page().findByRole("radio", { name: /Home/ });

    await user.click(placeButton());

    expect(form().getByLabelText(/Name on card/)).toHaveAttribute("aria-invalid", "true");
    expect(form().getByLabelText(/Name on card/)).toHaveFocus();
  });

  it("disables the button while the order is on its way, so a second press does nothing", async () => {
    const { user, server } = await openCheckout();
    await page().findByRole("radio", { name: /Home/ });
    await payWith(user);
    let finish = () => {};
    const gate = new Promise<void>((resolve) => (finish = resolve));
    const handle = server.handle;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/orders") && init?.method === "POST") await gate;
      return handle(input, init);
    }));

    await user.click(placeButton());

    expect(await summary().findByRole("button", { name: "Placing your order..." })).toBeDisabled();
    finish();
    await screen.findByRole("heading", { level: 1, name: /^SC-/ });
    expect(server.callsTo("POST", "/api/orders")).toHaveLength(1);
  });
});

describe("the checkout: when something is wrong", () => {
  it("says that the cart changed, makes no order, and reads the cart again", async () => {
    const { user, server } = await openCheckout();
    await page().findByRole("radio", { name: /Home/ });
    await payWith(user);
    server.override = (call) => (call.method === "POST" && call.path === "/api/orders" ? failing(409, "CART_CHANGED") : undefined);

    await user.click(placeButton());

    expect(await screen.findByRole("alert", { name: "" })).toBeDefined();
    expect(await screen.findByText(/Something in your cart is not available as it was, so no order was made/)).toBeInTheDocument();
    await waitFor(() => expect(server.callsTo("GET", "/api/checkout").length).toBeGreaterThan(1));
    expect(server.orders).toHaveLength(0);
  });

  it("says that there are fewer left than the cart needs", async () => {
    const { user, server } = await openCheckout();
    await page().findByRole("radio", { name: /Home/ });
    await payWith(user);
    server.override = (call) => (call.method === "POST" && call.path === "/api/orders" ? failing(409, "INSUFFICIENT_STOCK") : undefined);

    await user.click(placeButton());

    expect(await screen.findByText(/There are fewer left than your cart needs/)).toBeInTheDocument();
  });

  it("does not place the order and tells the person when a line was sold out", async () => {
    await openCheckout({ lines: [line("fleur-de-sel-bar", 1)] });

    expect(summary().getByText("Sold out. Remove it to continue.")).toBeInTheDocument();
    expect(placeButton()).toBeDisabled();
    expect(summary().getByRole("button", { name: "Change your cart" })).toBeInTheDocument();
  });

  it("says that nothing was charged when the server cannot be reached, and keeps what was typed", async () => {
    const { user, server } = await openCheckout();
    await page().findByRole("radio", { name: /Home/ });
    await payWith(user);
    const handle = server.handle;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => (String(input).startsWith("/api/orders") && init?.method === "POST" ? Promise.reject(new TypeError("Failed to fetch")) : handle(input, init))));

    await user.click(placeButton());

    expect(await screen.findByText(/We couldn't reach the server, so no order was made and nothing was charged/)).toBeInTheDocument();
    expect(form().getByLabelText(/Name on card/)).toHaveValue("Isabel Vasquez");
    expect(server.orders).toHaveLength(0);
  });

  it("says when the person has tried too many times", async () => {
    const { user, server } = await openCheckout();
    await page().findByRole("radio", { name: /Home/ });
    await payWith(user);
    server.override = (call) => (call.method === "POST" && call.path === "/api/orders" ? failing(429, "RATE_LIMITED") : undefined);

    await user.click(placeButton());

    expect(await screen.findByText(/You have tried many times/)).toBeInTheDocument();
  });

  it("says that the checkout could not be loaded, and loads it after a second try", async () => {
    const user = userEvent.setup();
    const server = installFakeServer([retailAccount]);
    const signedIn = sessionFor(server, server.accounts[0]);
    server.carts.set(`user:${server.accounts[0].id}`, [line("ecuador-72", 1)]);
    server.override = (call) => (call.path.startsWith("/api/checkout") ? failing(500, "INTERNAL_ERROR") : undefined);
    renderAt("/en/checkout", { user: signedIn });

    expect(await screen.findByText("We couldn't load your checkout.")).toBeInTheDocument();
    server.override = null;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Checkout" })).toBeInTheDocument();
  });
});

describe("the checkout: the page", () => {
  it("has no form inside another form (the address form is a form too, and browsers do not keep nested forms)", async () => {
    const { user } = await openCheckout();
    await page().findByRole("radio", { name: /Home/ });
    await user.click(page().getByRole("button", { name: "Add a new address" }));

    await screen.findByRole("form", { name: "New address" });
    expect(document.querySelectorAll("form form")).toHaveLength(0);
  });
});

describe("the checkout: the address", () => {
  it("opens the form for a person who has no address, and uses the new one", async () => {
    const { user, server } = await openCheckout({ addresses: [] });

    expect(await screen.findByText("You have no saved address yet. Add one to continue.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Name for this address/), "Studio");
    await user.type(screen.getByLabelText(/Street address/), "9 Bean St");
    await user.type(screen.getByLabelText(/^City/), "Austin");
    await user.type(screen.getByLabelText(/State or region/), "TX");
    await user.type(screen.getByLabelText(/Zip code/), "78701");
    await user.type(screen.getByLabelText(/^Country/), "United States");
    await user.click(screen.getByRole("button", { name: /^Save address/ }));

    expect(await page().findByRole("radio", { name: /Studio/ })).toBeChecked();
    expect(server.addresses).toHaveLength(1);
  });

  it("adds a new address next to the saved ones, without leaving the page, and chooses it", async () => {
    const { user } = await openCheckout();
    await page().findByRole("radio", { name: /Home/ });

    await user.click(page().getByRole("button", { name: "Add a new address" }));
    await user.type(screen.getByLabelText(/Name for this address/), "Cabin");
    await user.type(screen.getByLabelText(/Street address/), "1 Pine Rd");
    await user.type(screen.getByLabelText(/^City/), "Austin");
    await user.type(screen.getByLabelText(/State or region/), "TX");
    await user.type(screen.getByLabelText(/Zip code/), "78702");
    await user.type(screen.getByLabelText(/^Country/), "United States");
    await user.click(screen.getByRole("button", { name: /^Save address/ }));

    expect(await page().findByRole("radio", { name: /Cabin/ })).toBeChecked();
    expect(page().getAllByRole("radio", { name: /Home|Office|Cabin/ })).toHaveLength(3);
  });

  it("says that the addresses could not be loaded, with a way to try again", async () => {
    await openCheckout({ prepare: (server) => (server.override = (call) => (call.path === "/api/users/me/addresses" ? failing(500, "INTERNAL_ERROR") : undefined)) });

    expect(await screen.findByText("We couldn't load your addresses.")).toBeInTheDocument();
  });
});
