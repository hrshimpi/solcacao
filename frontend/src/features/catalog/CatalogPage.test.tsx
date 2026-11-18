import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFakeServer } from "../../test/fakeServer";
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

describe("shop page, while the products are on their way", () => {
  it("says that the collection is loading, then lists it", async () => {
    // the server answers for the products when the test lets it
    const server = installFakeServer();
    let letItAnswer = () => {};
    const gate = new Promise<void>((resolve) => (letItAnswer = resolve));
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/products")) await gate;
      return server.handle(input, init);
    }));
    renderAt("/en/shop?min=55", { productsFromServer: true });

    expect(await screen.findByRole("heading", { level: 1, name: "The collection" })).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByRole("status")).toHaveTextContent("Loading the collection...");
    expect(screen.queryByText("No specimens match these filters.")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);

    letItAnswer();

    await waitFor(() => expect(screen.getAllByRole("article").length).toBeGreaterThan(3));
    expect(within(screen.getByRole("main")).getByRole("status")).toHaveTextContent(/specimens/);
  });

  it("says that the collection could not be loaded, and lists it after a second try", async () => {
    const user = userEvent.setup();
    const server = installFakeServer();
    server.override = (call) => (call.path.startsWith("/api/products") ? new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Down.", details: [] } }), { status: 500 }) : undefined);
    renderAt("/en/shop?min=55", { productsFromServer: true });

    expect(await screen.findByText("We couldn't load the collection.")).toBeInTheDocument();
    expect(screen.queryByText("No specimens match these filters.")).not.toBeInTheDocument();

    server.override = null;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getAllByRole("article").length).toBeGreaterThan(3));
  });

  it("ignores an origin in the address that the shop does not have", async () => {
    renderAt("/en/shop?min=55&origin=mars", { productsFromServer: true });

    await waitFor(() => expect(screen.getAllByRole("article").length).toBeGreaterThan(3));
  });
});
