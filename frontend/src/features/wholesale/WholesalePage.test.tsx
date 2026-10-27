import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { en } from "../../i18n/en";
import { es } from "../../i18n/es";
import { renderAt } from "../../test/renderAt";

// the three ways into the studio on the page: the button at the top, the one in "How it works" and the closing one
// (index is the place among the links with the same name)
const entries = [
  { place: "the button at the top", name: "Enter the Corporate Cacao Studio", spanish: es.wholesale.enterStudio, index: 0 },
  { place: "Start in the Studio", name: "Start in the Studio", spanish: es.wholesale.startStudio, index: 0 },
  { place: "the closing button", name: "Enter the Corporate Cacao Studio", spanish: es.wholesale.enterStudio, index: 1 },
] as const;

function entry(name: string, index: number) {
  return within(screen.getByRole("main")).getAllByRole("link", { name })[index];
}

describe("the wholesale page", () => {
  it("is public: a guest sees the page and is not sent anywhere", async () => {
    const { router } = renderAt("/en/wholesale");

    expect(await screen.findByRole("heading", { level: 1, name: "Custom Chocolate, Crafted for Your Brand." })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en/wholesale");
  });

  it("is public for every kind of account", async () => {
    for (const account of ["retail", "business"] as const) {
      const { unmount, router } = renderAt("/en/wholesale", { account });

      expect(await screen.findByRole("heading", { level: 1, name: /Custom Chocolate/ })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/en/wholesale");
      unmount();
    }
  });

  it("has two Enter the Corporate Cacao Studio buttons and one Start in the Studio", async () => {
    renderAt("/en/wholesale");
    await screen.findByRole("heading", { level: 1 });
    const main = within(screen.getByRole("main"));

    expect(main.getAllByRole("link", { name: "Enter the Corporate Cacao Studio" })).toHaveLength(2);
    expect(main.getAllByRole("link", { name: "Start in the Studio" })).toHaveLength(1);
  });

  it.each(entries)("$place leads to /en/wholesale/studio", async ({ name, index }) => {
    renderAt("/en/wholesale");
    await screen.findByRole("heading", { level: 1 });

    expect(entry(name, index)).toHaveAttribute("href", "/en/wholesale/studio");
  });

  it.each(entries)("$place leads to /es/wholesale/studio on the Spanish page", async ({ spanish, index }) => {
    renderAt("/es/wholesale");
    await screen.findByRole("heading", { level: 1 });

    expect(entry(spanish, index)).toHaveAttribute("href", "/es/wholesale/studio");
  });

  it.each(entries)("$place opens the studio for a business account", async ({ name, index }) => {
    const user = userEvent.setup();
    const { router } = renderAt("/en/wholesale", { account: "business" });
    await screen.findByRole("heading", { level: 1 });

    await user.click(entry(name, index));

    expect(await screen.findByRole("heading", { level: 1, name: "The Corporate Cacao Studio" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en/wholesale/studio");
  });

  it.each(entries)("$place opens the sign in page for a guest, who is then brought to the studio", async ({ name, index }) => {
    const user = userEvent.setup();
    const { router } = renderAt("/en/wholesale");
    await screen.findByRole("heading", { level: 1 });

    await user.click(entry(name, index));

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en/account/login");
    expect(router.state.location.search).toBe("?next=%2Fwholesale%2Fstudio");
  });

  it.each(entries)("$place opens the message about business accounts for a retail account", async ({ name, index }) => {
    const user = userEvent.setup();
    const { router } = renderAt("/en/wholesale", { account: "retail" });
    await screen.findByRole("heading", { level: 1 });

    await user.click(entry(name, index));

    expect(await screen.findByRole("heading", { level: 1, name: "The studio is for business accounts" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en/wholesale/studio");
  });

  it("has no link or button on it that goes nowhere", async () => {
    renderAt("/en/wholesale");
    await screen.findByRole("heading", { level: 1 });
    const main = within(screen.getByRole("main"));

    for (const link of main.queryAllByRole("link")) {
      expect(link.getAttribute("href"), link.textContent ?? "").toMatch(/^\/(en|es)(\/|$)/);
    }
    expect(main.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("the Spanish wholesale page", () => {
  // informal "tu" forms. The page speaks to the reader as "usted".
  const informal = /\b(tú|tu|tus|ti|contigo|elige|sube|revisa|pides|puedes|tienes|quieres|empieza|envía)\b/i;

  it("speaks to the reader as usted", async () => {
    renderAt("/es/wholesale");
    const main = await screen.findByRole("main");

    expect(within(main).getByRole("heading", { level: 1, name: "Chocolate a la medida, creado para su marca." })).toBeInTheDocument();
    expect(within(main).getByText("Elija su perfil de cacao")).toBeInTheDocument();
    expect(within(main).getByText("Suba sus materiales de marca")).toBeInTheDocument();
    expect(within(main).getByText("Revise y envíe para cotizar")).toBeInTheDocument();
    expect(within(main).getByText("¿Listo para crear su programa de chocolate?")).toBeInTheDocument();
    expect(main.textContent ?? "").not.toMatch(informal);
  });

  it("has no informal forms in any of the wholesale strings, the studio message included", () => {
    const strings = Object.entries(es.wholesale);

    expect(strings.length).toBeGreaterThan(20);
    for (const [key, value] of strings) {
      expect(value, `wholesale.${key}`).not.toMatch(informal);
    }
  });

  it("has a Spanish string for every English wholesale string", () => {
    expect(Object.keys(es.wholesale).sort()).toEqual(Object.keys(en.wholesale).sort());
  });
});
