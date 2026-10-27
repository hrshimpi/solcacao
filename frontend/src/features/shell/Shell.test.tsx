import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt } from "../../test/renderAt";

describe("language buttons", () => {
  it("show which language is on with aria-pressed and name their own language", async () => {
    renderAt("/en");

    const group = await screen.findByRole("group", { name: "Language" });
    const english = within(group).getByRole("button", { name: "EN, English" });
    const spanish = within(group).getByRole("button", { name: "ES, Español" });

    expect(english).toHaveAttribute("aria-pressed", "true");
    expect(spanish).toHaveAttribute("aria-pressed", "false");
    expect(english).toHaveAttribute("lang", "en");
    expect(spanish).toHaveAttribute("lang", "es");
  });

  it("switch the page text, the page language and the pressed button", async () => {
    const user = userEvent.setup();
    renderAt("/en");

    await user.click(await screen.findByRole("button", { name: "ES, Español" }));

    expect(await screen.findByRole("button", { name: "ES, Español" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.lang).toBe("es");
    expect(screen.getByRole("navigation", { name: "Principal" })).toBeInTheDocument();
    expect(localStorage.getItem("sc_lang")).toBe("es");
  });
});

describe("header buttons", () => {
  it("every icon button has an accessible name", async () => {
    renderAt("/en");

    const header = (await screen.findByRole("banner")) as HTMLElement;
    for (const button of within(header).getAllByRole("button")) {
      expect(button).toHaveAccessibleName();
    }
  });

  it("the cart button says how many items are in the cart", async () => {
    const user = userEvent.setup();
    renderAt("/en/shop?min=55");

    expect(await screen.findByRole("button", { name: "Cart, empty" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /^Add to cart, / })[0]);
    await user.keyboard("{Escape}");

    expect(await screen.findByRole("button", { name: "Cart, 1 item" })).toBeInTheDocument();
  });
});

describe("dialogs", () => {
  it("the cart opens as a dialog, closes with Escape and gives focus back", async () => {
    const user = userEvent.setup();
    renderAt("/en");

    const opener = await screen.findByRole("button", { name: "Cart, empty" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Your cart" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps Tab inside an open dialog", async () => {
    const user = userEvent.setup();
    renderAt("/en");

    await user.click(await screen.findByRole("button", { name: "Cart, empty" }));
    const dialog = screen.getByRole("dialog");

    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("search finds a product by its origin and says how many it found", async () => {
    const user = userEvent.setup();
    renderAt("/en");

    await user.click(await screen.findByRole("button", { name: "Search" }));
    const dialog = screen.getByRole("dialog", { name: "Search" });
    const input = within(dialog).getByRole("searchbox");
    expect(input).toHaveFocus();

    await user.type(input, "peru");

    expect(within(dialog).getByRole("status")).toHaveTextContent(/product/);
    expect(within(dialog).getByRole("link", { name: /Peru 68%/ })).toHaveAttribute("href", "/en/shop/peru-68");
  });
});
