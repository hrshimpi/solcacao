import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFakeServer } from "../../test/fakeServer";
import { fixtureId } from "../../test/productFixtures";
import { renderAt } from "../../test/renderAt";

const heading = (name: string) => screen.findByRole("heading", { level: 1, name });

describe("product page", () => {
  it("shows the product of the address, with its origin, price and tasting notes", async () => {
    renderAt("/en/shop/peru-68");

    expect(await heading("Peru 68%")).toBeInTheDocument();
    expect(screen.getByText(/Peru · Bar/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Tasting notes" })).toBeInTheDocument();
  });

  it("says in Spanish what the server sends in Spanish", async () => {
    renderAt("/es/shop/peru-68");

    expect(await heading("Perú 68%")).toBeInTheDocument();
  });

  it("adds the chosen quantity to the cart on the server", async () => {
    const server = installFakeServer();
    const user = userEvent.setup();
    renderAt("/en/shop/ecuador-72");
    await heading("Ecuador 72%");

    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    await user.click(screen.getByRole("button", { name: "Add to cart" }));

    expect(await screen.findByRole("dialog", { name: "Your cart" })).toHaveTextContent("Ecuador 72%");
    expect(server.callsTo("POST", "/api/cart/items")[0].body).toEqual({ kind: "product", productId: fixtureId("ecuador-72"), quantity: 2 });
  });

  it("says that a product is sold out and has nothing to add", async () => {
    renderAt("/en/shop/fleur-de-sel-bar");
    await heading("Fleur de Sel Bar");

    expect(screen.getByRole("button", { name: "Sold out" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Increase quantity" })).not.toBeInTheDocument();
  });

  it("says how many are left when there are only a few", async () => {
    renderAt("/en/shop/venezuela-76");
    await heading("Venezuela 76%");

    expect(screen.getByText("Only 6 left")).toBeInTheDocument();
  });
});

describe("product page, while the product is on its way", () => {
  it("says that the specimen is loading, then shows it", async () => {
    renderAt("/en/shop/ecuador-72", { productsFromServer: true });

    expect(screen.getByText("Loading the specimen...")).toBeInTheDocument();
    expect(await heading("Ecuador 72%")).toBeInTheDocument();
  });

  it("is the page of a missing product once the shop is loaded and does not have the slug", async () => {
    renderAt("/en/shop/no-such-bar", { productsFromServer: true });

    expect(await screen.findByRole("heading", { name: "We couldn't find that page." })).toBeInTheDocument();
  });

  it("is the page of a missing product for a product that was switched off", async () => {
    installFakeServer().inactive.add("ecuador-72");
    renderAt("/en/shop/ecuador-72", { productsFromServer: true });

    expect(await screen.findByRole("heading", { name: "We couldn't find that page." })).toBeInTheDocument();
  });

  it("says that the specimen could not be loaded, and tries again when asked", async () => {
    const server = installFakeServer();
    server.override = (call) => (call.path.startsWith("/api/products") ? new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Down.", details: [] } }), { status: 500 }) : undefined);
    const user = userEvent.setup();
    renderAt("/en/shop/ecuador-72", { productsFromServer: true });

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't load this specimen.");
    // the page is not a "not found", the product may well exist
    expect(screen.queryByRole("heading", { name: "We couldn't find that page." })).not.toBeInTheDocument();

    server.override = null;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await heading("Ecuador 72%")).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole("main")).queryByRole("alert")).not.toBeInTheDocument());
  });
});
