import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccountType } from "../features/auth/components/AuthShell";
import { renderAt } from "../test/renderAt";

describe("pages", () => {
  const pages: [string, RegExp, AccountType?][] = [
    ["/en", /Grown in Sunlight/],
    ["/en/shop", /The collection/],
    ["/en/shop/ecuador-72", /Ecuador 72%/],
    ["/en/wholesale", /Custom Chocolate, Crafted for Your Brand/],
    ["/en/wholesale/studio", /The Corporate Cacao Studio/, "business"],
    ["/en/sampler", /Build your own sampler/],
    ["/en/contact", /Get in touch/],
    ["/en/account/login", /Sign in/],
    ["/en/account/register", /Create account/],
    ["/en/profile", /Your profile/],
    ["/es/shop", /La colección/],
    ["/es/profile", /Tu perfil/],
  ];

  it.each(pages)("%s shows its heading", async (path, heading, account) => {
    renderAt(path, { account });

    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
  });

  it.each(pages)("%s has exactly one h1", async (path, _heading, account) => {
    renderAt(path, { account });
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it.each(pages)("%s sets a page title and the page language", async (path, _heading, account) => {
    renderAt(path, { account });
    await screen.findByRole("heading", { level: 1 });

    expect(document.title).toMatch(/ \| SolCacao$/);
    expect(document.documentElement.lang).toBe(path.startsWith("/es") ? "es" : "en");
  });

  it("has a main landmark and two navigation landmarks with different names", async () => {
    renderAt("/en");
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Footer" })).toBeInTheDocument();
  });
});

describe("language in the address", () => {
  it("sends / to /en when the browser language is English", async () => {
    const { router } = renderAt("/");

    await screen.findByRole("heading", { level: 1, name: /Grown in Sunlight/ });
    expect(router.state.location.pathname).toBe("/en");
  });

  it("sends / to the saved language", async () => {
    localStorage.setItem("sc_lang", "es");
    const { router } = renderAt("/");

    await screen.findByRole("heading", { level: 1 });
    expect(router.state.location.pathname).toBe("/es");
  });

  it("keeps the same page when you switch the language", async () => {
    const user = userEvent.setup();
    const { router } = renderAt("/en/shop?category=bar");

    await user.click(screen.getByRole("button", { name: "ES, Español" }));

    expect(router.state.location.pathname).toBe("/es/shop");
    expect(router.state.location.search).toBe("?category=bar");
    expect(await screen.findByRole("heading", { level: 1, name: "La colección" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("es");
  });
});

describe("not found", () => {
  it.each(["/nothing-here", "/en/nothing-here", "/en/shop/no-such-bar"])("%s shows the not found page", async (path) => {
    renderAt(path);

    expect(await screen.findByRole("heading", { level: 1, name: /couldn't find that page/i })).toBeInTheDocument();
  });
});

describe("navigation", () => {
  it("opens the shop from the main navigation", async () => {
    const user = userEvent.setup();
    renderAt("/en");

    const nav = screen.getByRole("navigation", { name: "Main" });
    await user.click(within(nav).getByRole("link", { name: "Shop" }));

    expect(await screen.findByRole("heading", { level: 1, name: /The collection/ })).toBeInTheDocument();
  });

  it("moves focus to the page heading after a link is used", async () => {
    const user = userEvent.setup();
    renderAt("/en");

    const nav = screen.getByRole("navigation", { name: "Main" });
    await user.click(within(nav).getByRole("link", { name: "Wholesale" }));

    const heading = await screen.findByRole("heading", { level: 1, name: /Custom Chocolate/ });
    expect(heading).toHaveFocus();
  });

  it("has a skip link that jumps to the main content", async () => {
    const user = userEvent.setup();
    renderAt("/en");

    await user.tab();
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("switches between sign in and create account", async () => {
    const user = userEvent.setup();
    renderAt("/en/account/login");

    await user.click(screen.getByRole("link", { name: /Create an account/ }));

    expect(await screen.findByRole("heading", { level: 1, name: "Create account" })).toBeInTheDocument();
  });
});
