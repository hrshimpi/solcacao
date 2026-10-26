import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getProducts } from "../../data/products";
import { renderAt } from "../../test/renderAt";

const products = getProducts("en");

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
    expect(tile(0)).toHaveFocus();
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
    const user = await openSampler();

    for (let i = 0; i < 4; i++) await user.click(tile(i));
    await user.click(screen.getByRole("button", { name: "Add sampler to cart" }));

    const drawer = await screen.findByRole("dialog", { name: "Your cart" });
    expect(drawer).toHaveTextContent("Custom sampler");

    const saved = JSON.parse(localStorage.getItem("sc_cart") ?? "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0].kind).toBe("sampler");
    expect(saved[0].productIds).toHaveLength(4);
  });
});
