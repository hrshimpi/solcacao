import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt } from "../../test/renderAt";

describe("shop page", () => {
  it("lists the products and says how many there are", async () => {
    renderAt("/en/shop?min=55");

    expect(await screen.findByRole("heading", { level: 1, name: "The collection" })).toBeInTheDocument();
    expect(screen.getAllByRole("article").length).toBeGreaterThan(3);
    expect(within(screen.getByRole("main")).getByRole("status")).toHaveTextContent(/specimens/);
  });

  it("reads the origin filter from the address", async () => {
    renderAt("/en/shop?min=55&origin=peru");

    await screen.findByRole("heading", { level: 1 });
    const cards = screen.getAllByRole("article");
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card).toHaveTextContent(/Peru/);
    }
    expect(screen.getByRole("checkbox", { name: "Peru" })).toBeChecked();
  });

  it("writes a filter into the address when it is used", async () => {
    const user = userEvent.setup();
    const { router } = renderAt("/en/shop?min=55");

    await user.click(await screen.findByRole("checkbox", { name: "Ecuador" }));

    expect(router.state.location.search).toContain("origin=ecuador");
  });

  it("shows an empty state with a button that clears the filters", async () => {
    const user = userEvent.setup();
    const { router } = renderAt("/en/shop?min=83&max=85&category=truffle");

    const clear = await screen.findByRole("button", { name: /Clear all filters/i });
    await user.click(clear);

    expect(router.state.location.search).toBe("");
    expect(screen.getAllByRole("article").length).toBeGreaterThan(0);
  });

  it("flavor compass notes are toggle buttons", async () => {
    const user = userEvent.setup();
    renderAt("/en/shop?min=55");

    const group = await screen.findByRole("group", { name: "Flavor compass" });
    const fruity = within(group).getByRole("button", { name: /fruity/i });
    expect(fruity).toHaveAttribute("aria-pressed", "false");

    await user.click(fruity);
    expect(fruity).toHaveAttribute("aria-pressed", "true");
  });

  it("the range has number inputs and sliders", async () => {
    renderAt("/en/shop");

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByRole("spinbutton").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("slider").length).toBeGreaterThanOrEqual(2);
  });
});
