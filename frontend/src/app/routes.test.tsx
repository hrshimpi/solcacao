import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "./routes";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe("pages", () => {
  const pages: [string, RegExp][] = [
    ["/", /Grown in Sunlight/],
    ["/shop", /The collection/],
    ["/shop/ecuador-72", /Ecuador 72%/],
    ["/wholesale", /Custom Chocolate, Crafted for Your Brand/],
    ["/wholesale/studio", /The Corporate Cacao Studio/],
    ["/login", /Sign in/],
    ["/register", /Create account/],
    ["/sampler", /Build your own sampler/],
  ];

  it.each(pages)("%s shows its heading", async (path, heading) => {
    renderAt(path);

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("shows the not found page for an unknown url", async () => {
    renderAt("/no-such-page");

    expect(
      await screen.findByRole("heading", { name: /couldn't find that page/i }),
    ).toBeInTheDocument();
  });

  it("shows the not found page for an unknown product", async () => {
    renderAt("/shop/no-such-bar");

    expect(
      await screen.findByRole("heading", { name: /couldn't find that page/i }),
    ).toBeInTheDocument();
  });
});

describe("navigation", () => {
  it("opens the shop from the menu", async () => {
    const user = userEvent.setup();
    renderAt("/");

    await user.click(screen.getAllByRole("link", { name: "Shop" })[0]);

    expect(await screen.findByRole("heading", { name: /The collection/ })).toBeInTheDocument();
  });

  it("switches between sign in and create account", async () => {
    const user = userEvent.setup();
    renderAt("/login");

    await user.click(screen.getByRole("button", { name: /Create an account/ }));

    expect(await screen.findByRole("heading", { name: "Create account" })).toBeInTheDocument();
  });
});

describe("cart", () => {
  it("collects products from the shop and shows them in the cart drawer", async () => {
    const user = userEvent.setup();
    renderAt("/shop");

    await user.click(screen.getAllByRole("button", { name: "Add to cart" })[0]);
    await user.click(screen.getByRole("button", { name: /^Cart/ }));

    const drawer = await screen.findByRole("dialog", { name: "Your cart" });
    expect(drawer).toHaveTextContent("Ecuador 72%");
    expect(drawer).toHaveTextContent("$12.00");
  });

  it("says that checkout isn't available yet", async () => {
    const user = userEvent.setup();
    renderAt("/shop");

    await user.click(screen.getAllByRole("button", { name: "Add to cart" })[0]);
    await user.click(screen.getByRole("button", { name: /^Cart/ }));
    await user.click(await screen.findByRole("button", { name: "Checkout" }));

    expect(screen.getByText(/checkout isn't available yet/i)).toBeInTheDocument();
  });
});
