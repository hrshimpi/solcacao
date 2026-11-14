import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFakeServer, type FakeCartLine, type FakeServer } from "../../test/fakeServer";
import { fixtureId, fixtureRecords } from "../../test/productFixtures";
import { renderAt } from "../../test/renderAt";

const cents = (slug: string) => fixtureRecords.find((record) => record.product.slug === slug)!.product.price;

// a line of the cart of the visitor, as the fake server keeps it
function productLine(slug: string, quantity: number): FakeCartLine {
  return { lineId: `p-${fixtureId(slug)}`, kind: "product", productIds: [fixtureId(slug)], quantity, unitPrice: cents(slug) };
}

function samplerLine(slugs: string[], quantity = 1): FakeCartLine {
  return { lineId: "s-0123456789abcdef0123", kind: "sampler", productIds: slugs.map(fixtureId).sort(), quantity, unitPrice: slugs.reduce((sum, slug) => sum + cents(slug), 0) };
}

const dollars = (value: number) => `$${value.toFixed(2)}`;

// opens the shop with a cart that the server already has, and the cart dialog
async function openCart(lines: FakeCartLine[] = [], prepare: (server: FakeServer) => void = () => {}) {
  const server = installFakeServer();
  server.carts.set("guest", lines);
  prepare(server);
  const user = userEvent.setup();
  const { router } = renderAt("/en/shop");

  await user.click(await screen.findByRole("button", { name: /^Cart, / }));
  const dialog = await screen.findByRole("dialog", { name: "Your cart" });
  return { server, user, router, dialog: within(dialog) };
}

describe("cart dialog", () => {
  it("says that the cart is empty, with a way back to the shop", async () => {
    const { dialog } = await openCart();

    expect(await dialog.findByText("No items yet.")).toBeInTheDocument();
    expect(dialog.getByRole("link", { name: "Browse the shop" })).toHaveAttribute("href", "/en/shop");
    expect(dialog.queryByText("Subtotal")).not.toBeInTheDocument();
  });

  it("lists what the server holds, with the price of each line and the subtotal", async () => {
    const { dialog } = await openCart([productLine("ecuador-72", 2), productLine("peru-68", 1)]);

    expect(await dialog.findByText("Ecuador 72%")).toBeInTheDocument();
    expect(dialog.getByText("Peru 68%")).toBeInTheDocument();
    expect(dialog.getByText(dollars((cents("ecuador-72") * 2) / 100))).toBeInTheDocument();
    expect(dialog.getByText(dollars((cents("ecuador-72") * 2 + cents("peru-68")) / 100))).toBeInTheDocument();
  });

  it("shows a sampler as one item with the names of its specimens", async () => {
    const slugs = ["ecuador-72", "peru-68", "venezuela-76", "colombia-64"];
    const { dialog } = await openCart([samplerLine(slugs)]);

    expect(await dialog.findByText("Custom sampler")).toBeInTheDocument();
    const names = dialog.getByText(/Ecuador 72%/);
    for (const name of ["Ecuador 72%", "Peru 68%", "Venezuela 76%", "Colombia 64%"]) expect(names).toHaveTextContent(name);
  });

  it("changes the quantity on the server with the buttons of the line", async () => {
    const { dialog, user, server } = await openCart([productLine("ecuador-72", 2)]);

    await user.click(await dialog.findByRole("button", { name: "Add one Ecuador 72%" }));

    await waitFor(() => expect(server.callsTo("PATCH", `/api/cart/items/p-${fixtureId("ecuador-72")}`)).toHaveLength(1));
    expect(server.callsTo("PATCH", `/api/cart/items/p-${fixtureId("ecuador-72")}`)[0].body).toEqual({ quantity: 3 });
    // the total of the line and the subtotal, which are the same when there is one line
    await waitFor(() => expect(dialog.getAllByText(dollars((cents("ecuador-72") * 3) / 100))).toHaveLength(2));
  });

  it("removes a line", async () => {
    const { dialog, user } = await openCart([productLine("ecuador-72", 1)]);

    await user.click(await dialog.findByRole("button", { name: "Remove Ecuador 72% from the cart" }));

    expect(await dialog.findByText("No items yet.")).toBeInTheDocument();
  });

  it("only lets a sold out line be removed, and says why", async () => {
    const { dialog } = await openCart([productLine("fleur-de-sel-bar", 1)]);

    expect(await dialog.findByText("Sold out. Remove it to continue.")).toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: /Add one/ })).not.toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Remove Fleur de Sel Bar from the cart" })).toBeInTheDocument();
  });

  it("only lets a line of a product that was switched off be removed, and says why", async () => {
    const { dialog } = await openCart([productLine("peru-68", 1), productLine("ecuador-72", 1)], (server) => server.inactive.add("peru-68"));

    expect(await dialog.findByText("No longer available. Remove it to continue.")).toBeInTheDocument();
    expect(dialog.getAllByRole("button", { name: /Add one/ })).toHaveLength(1);
  });

  it("lowers a quantity that is more than the stock to what there is, and says so", async () => {
    const { server } = await openCart([productLine("venezuela-76", 4)], (fake) => fake.setStock("venezuela-76", 2));

    await waitFor(() => expect(server.callsTo("PATCH", `/api/cart/items/p-${fixtureId("venezuela-76")}`)[0]?.body).toEqual({ quantity: 2 }));
    await waitFor(() => expect(screen.getAllByRole("status").some((status) => /Only 2 of Venezuela 76%/.test(status.textContent ?? ""))).toBe(true));
  });

  it("goes to the checkout with a link, and a visitor is sent to sign in and then back to the checkout", async () => {
    const { dialog, user, router } = await openCart([productLine("ecuador-72", 1)]);
    expect(await dialog.findByText("Shipping calculated at checkout")).toBeInTheDocument();
    expect(dialog.getByRole("link", { name: "Checkout" })).toHaveAttribute("href", "/en/checkout");

    await user.click(dialog.getByRole("link", { name: "Checkout" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?next=%2Fcheckout");
    expect(screen.queryByRole("dialog", { name: "Your cart" })).not.toBeInTheDocument();
  });
});

describe("cart dialog, when the server is slow or not there", () => {
  it("says that the cart is loading until the server answers", async () => {
    const server = installFakeServer();
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => (String(input).startsWith("/api/cart") ? new Promise<Response>(() => {}) : server.handle(input, init))));
    const user = userEvent.setup();
    renderAt("/en/shop");

    await user.click(await screen.findByRole("button", { name: /^Cart, / }));

    expect(within(await screen.findByRole("dialog", { name: "Your cart" })).getByText("Loading your cart...")).toBeInTheDocument();
  });

  it("says that the cart could not be loaded, and loads it when asked again", async () => {
    const server = installFakeServer();
    server.carts.set("guest", [productLine("ecuador-72", 1)]);
    server.override = (call) => (call.path.startsWith("/api/cart") ? new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Down.", details: [] } }), { status: 500 }) : undefined);
    const user = userEvent.setup();
    renderAt("/en/shop");

    await user.click(await screen.findByRole("button", { name: /^Cart, / }));
    const dialog = within(await screen.findByRole("dialog", { name: "Your cart" }));
    expect(await dialog.findByText("We couldn't load your cart.")).toBeInTheDocument();

    server.override = null;
    await user.click(dialog.getByRole("button", { name: "Try again" }));

    expect(await dialog.findByText("Ecuador 72%")).toBeInTheDocument();
  });

  it("keeps the lines and says so when a change does not reach the server", async () => {
    const { dialog, user, server } = await openCart([productLine("ecuador-72", 1)]);
    await dialog.findByText("Ecuador 72%");
    server.override = (call) => (call.method === "PATCH" ? new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Down.", details: [] } }), { status: 500 }) : undefined);

    await user.click(dialog.getByRole("button", { name: "Add one Ecuador 72%" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent("Something went wrong, so your cart was not changed.");
    expect(dialog.getByText("Ecuador 72%")).toBeInTheDocument();
    expect(dialog.getAllByText(dollars(cents("ecuador-72") / 100))).toHaveLength(2);
  });
});
