import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFakeServer } from "../../test/fakeServer";
import { productsFor } from "../../test/productFixtures";
import { renderAt } from "../../test/renderAt";

const products = productsFor("en");

async function openSampler() {
  const user = userEvent.setup();
  renderAt("/en/sampler");
  await screen.findByRole("heading", { level: 1, name: "Build your own sampler" });
  return user;
}

function tile(index: number) {
  return screen.getByRole("button", { name: products[index].name });
}

describe("sampler page", () => {
  it("starts with nothing chosen and the add button off", async () => {
    await openSampler();

    expect(screen.getByText("0 of 6 chosen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add sampler to cart" })).toBeDisabled();
    expect(screen.getByText("Choose 4 more to complete your sampler.")).toBeInTheDocument();
  });

  it("counts the specimens and marks the chosen ones as pressed", async () => {
    const user = await openSampler();

    await user.click(tile(0));
    await user.click(tile(1));

    expect(screen.getByText("2 of 6 chosen")).toBeInTheDocument();
    expect(tile(0)).toHaveAttribute("aria-pressed", "true");
    expect(tile(2)).toHaveAttribute("aria-pressed", "false");
  });

  it("lets you remove a specimen from the tray", async () => {
    const user = await openSampler();

    await user.click(tile(0));
    await user.click(screen.getByRole("button", { name: `Remove ${products[0].name} from the sampler` }));

    expect(screen.getByText("0 of 6 chosen")).toBeInTheDocument();
    // focus moves back to the tile on the next animation frame
    await waitFor(() => expect(tile(0)).toHaveFocus());
  });

  it("stops at six specimens", async () => {
    const user = await openSampler();

    for (let i = 0; i < 6; i++) await user.click(tile(i));
    await user.click(tile(6));

    expect(screen.getByText("6 of 6 chosen")).toBeInTheDocument();
    expect(tile(6)).toHaveAttribute("aria-disabled", "true");
    expect(tile(6)).toHaveAttribute("aria-pressed", "false");
  });

  it("adds the sampler to the cart as one item", async () => {
    const server = installFakeServer();
    const user = await openSampler();

    for (let i = 0; i < 4; i++) await user.click(tile(i));
    await user.click(screen.getByRole("button", { name: "Add sampler to cart" }));

    const drawer = await screen.findByRole("dialog", { name: "Your cart" });
    expect(drawer).toHaveTextContent("Custom sampler");

    // the cart is kept by the server, which was asked for one sampler of the four specimens
    const [call] = server.callsTo("POST", "/api/cart/items");
    expect(call.body).toEqual({ kind: "sampler", productIds: products.slice(0, 4).map((product) => product.id) });
    expect(server.callsTo("POST", "/api/cart/items")).toHaveLength(1);
  });

  it("says that the specimens could not be loaded, and shows them after a second try", async () => {
    const user = userEvent.setup();
    const server = installFakeServer();
    server.override = (call) =>
      call.path.startsWith("/api/products") ? new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Down.", details: [] } }), { status: 500 }) : undefined;

    renderAt("/en/sampler", { productsFromServer: true });

    expect(await screen.findByText("We couldn't load the specimens.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: products[0].name })).not.toBeInTheDocument();

    server.override = null;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("button", { name: products[0].name })).toBeInTheDocument();
  });
});
