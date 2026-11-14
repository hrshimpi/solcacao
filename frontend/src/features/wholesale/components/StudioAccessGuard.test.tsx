import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AUTH_STORAGE_KEY } from "../../auth/AuthContext";
import { renderAt } from "../../../test/renderAt";

const studioHeading = { level: 1, name: "The Corporate Cacao Studio" } as const;

function open(path: string, account?: "retail" | "business") {
  const user = userEvent.setup();
  const result = renderAt(path, { account });
  return { user, ...result };
}

// the footer has a newsletter form with an email field too, so the form is looked for inside the page content
async function signInThroughTheForm(user: ReturnType<typeof userEvent.setup>, account: "retail" | "business") {
  const page = within(await screen.findByRole("main"));
  await user.click(page.getByRole("radio", { name: account === "business" ? /Business account|Cuenta de empresa/ : /Retail account|Cuenta personal/ }));
  await user.type(page.getByLabelText(/Email|Correo/), "isabel@example.com");
  await user.type(page.getByLabelText(/Password|Contraseña/), "a long password");
  await user.click(page.getByRole("button", { name: /^(Sign in|Iniciar sesión)$/ }));
}

function signedInUser() {
  return JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY) ?? "null");
}

describe("the studio for a guest", () => {
  it("sends the guest to the sign in page and remembers where they were going", async () => {
    const { router } = open("/en/wholesale/studio");

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en/account/login");
    expect(router.state.location.search).toBe("?next=%2Fwholesale%2Fstudio");
  });

  it("does not show the studio, not even for a moment", async () => {
    open("/en/wholesale/studio");

    await screen.findByRole("heading", { level: 1, name: "Sign in" });
    expect(screen.queryByRole("heading", studioHeading)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  it("uses the language of the address", async () => {
    const { router } = open("/es/wholesale/studio");

    expect(await screen.findByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/es/account/login");
    expect(router.state.location.search).toBe("?next=%2Fwholesale%2Fstudio");
  });

  it("replaces the studio address, so Back does not come back to a page that sends you away again", async () => {
    const { router } = open("/en/wholesale/studio");
    await screen.findByRole("heading", { level: 1, name: "Sign in" });

    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("keeps what comes after the page address", async () => {
    const { router } = open("/en/wholesale/studio?step=2");
    await screen.findByRole("heading", { level: 1, name: "Sign in" });

    expect(new URLSearchParams(router.state.location.search).get("next")).toBe("/wholesale/studio?step=2");
  });

  it("brings a guest who signs in as a business back to the studio", async () => {
    const { user, router } = open("/en/wholesale/studio");

    await signInThroughTheForm(user, "business");

    expect(await screen.findByRole("heading", studioHeading)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en/wholesale/studio");
    expect(router.state.location.search).toBe("");
    expect(signedInUser()).toEqual({ email: "isabel@example.com", accountType: "business" });
  });

  it("replaces the sign in page when coming back, so Back does not show the form again", async () => {
    const { user, router } = open("/en/wholesale/studio");

    await signInThroughTheForm(user, "business");
    await screen.findByRole("heading", studioHeading);

    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("shows the message to a guest who signs in with a retail account", async () => {
    const { user, router } = open("/en/wholesale/studio");

    await signInThroughTheForm(user, "retail");

    expect(await screen.findByRole("heading", { level: 1, name: "The studio is for business accounts" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en/wholesale/studio");
  });

  it("brings the guest back in the language they switched to on the way", async () => {
    const { user, router } = open("/en/wholesale/studio");
    await screen.findByRole("heading", { level: 1, name: "Sign in" });

    await user.click(screen.getByRole("button", { name: "ES, Español" }));
    expect(router.state.location.pathname).toBe("/es/account/login");
    expect(router.state.location.search).toBe("?next=%2Fwholesale%2Fstudio");
    await screen.findByRole("heading", { level: 1, name: "Iniciar sesión" });

    await signInThroughTheForm(user, "business");

    expect(await screen.findByRole("heading", { level: 1, name: "El Estudio de Cacao Corporativo" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/es/wholesale/studio");
  });

  it("is also the way in from the footer link", async () => {
    const { user, router } = open("/en");

    await user.click(within(screen.getByRole("navigation", { name: "Footer" })).getByRole("link", { name: "Request a quote" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?next=%2Fwholesale%2Fstudio");
  });

  it("goes home after signing in when the sign in page was opened by itself", async () => {
    const { user, router } = open("/en/account/login");

    await signInThroughTheForm(user, "retail");

    expect(await screen.findByRole("heading", { level: 1, name: /Grown in Sunlight/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en");
  });

  it.each(["//evil.example", "//evil.example/wholesale/studio", "https://evil.example", "/\\evil.example", "javascript:alert(1)", "/account/login"])(
    "does not follow the address %s after signing in",
    async (next) => {
      const { user, router } = open(`/en/account/login?next=${encodeURIComponent(next)}`);

      await signInThroughTheForm(user, "business");

      expect(await screen.findByRole("heading", { level: 1, name: /Grown in Sunlight/ })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/en");
    },
  );

  it("does not sign anyone in when the form has mistakes", async () => {
    const { user, router } = open("/en/wholesale/studio");
    const page = within(await screen.findByRole("main"));

    await user.click(page.getByRole("button", { name: "Sign in" }));

    expect(router.state.location.pathname).toBe("/en/account/login");
    expect(signedInUser()).toBeNull();
  });
});

describe("the studio for a retail account", () => {
  it("says that the studio is for business accounts, and does not show the studio", async () => {
    const { router } = open("/en/wholesale/studio", "retail");

    expect(await screen.findByRole("heading", { level: 1, name: "The studio is for business accounts" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", studioHeading)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en/wholesale/studio");
  });

  it("explains it and offers to create a business account", async () => {
    open("/en/wholesale/studio", "retail");
    const page = within(await screen.findByRole("main"));

    expect(page.getByText(/signed in with a retail account/)).toBeInTheDocument();
    expect(page.getByRole("link", { name: "Create a business account" })).toHaveAttribute("href", "/en/account/register?type=business");
    expect(page.getByRole("link", { name: "Back to wholesale" })).toHaveAttribute("href", "/en/wholesale");
  });

  it("has one h1 and a page title", async () => {
    open("/en/wholesale/studio", "retail");
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(document.title).toBe("Corporate Cacao Studio | SolCacao");
  });

  it("is written in Spanish for the Spanish address, with usted", async () => {
    open("/es/wholesale/studio", "retail");
    const page = within(await screen.findByRole("main"));

    expect(page.getByRole("heading", { level: 1, name: "El Estudio es para cuentas de empresa" })).toBeInTheDocument();
    expect(page.getByText(/Ha iniciado sesión con una cuenta personal/)).toBeInTheDocument();
    expect(page.getByRole("link", { name: "Crear una cuenta de empresa" })).toHaveAttribute("href", "/es/account/register?type=business");
    expect(page.getByRole("link", { name: "Volver a venta por mayor" })).toHaveAttribute("href", "/es/wholesale");
  });

  it("opens the create account page on the business account", async () => {
    const { user, router } = open("/en/wholesale/studio", "retail");

    await user.click(await screen.findByRole("link", { name: "Create a business account" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Create account" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en/account/register");
    const page = within(screen.getByRole("main"));
    expect(page.getByRole("radio", { name: "Business account" })).toBeChecked();
    expect(page.getByLabelText(/Company/)).toBeInTheDocument();
  });

  it("goes back to the wholesale page", async () => {
    const { user, router } = open("/en/wholesale/studio", "retail");

    await user.click(await screen.findByRole("link", { name: "Back to wholesale" }));

    expect(await screen.findByRole("heading", { level: 1, name: /Custom Chocolate/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en/wholesale");
  });

  it("lets the person in once they have created a business account", async () => {
    const { user, router } = open("/en/wholesale/studio", "retail");
    await user.click(await screen.findByRole("link", { name: "Create a business account" }));
    const page = within(await screen.findByRole("main"));

    await user.type(page.getByLabelText(/Full name/), "Isabel Vasquez");
    await user.type(page.getByLabelText(/Company/), "Hacienda Brands");
    await user.type(page.getByLabelText(/Email/), "isabel@hacienda.example");
    await user.type(page.getByLabelText(/Password/), "a long password");
    await user.click(page.getByRole("button", { name: "Create account" }));
    await screen.findByRole("heading", { level: 1, name: /Grown in Sunlight/ });
    expect(signedInUser()).toEqual({ email: "isabel@hacienda.example", accountType: "business", name: "Isabel Vasquez", companyName: "Hacienda Brands" });

    await act(async () => {
      await router.navigate("/en/wholesale/studio");
    });

    expect(await screen.findByRole("heading", studioHeading)).toBeInTheDocument();
  });
});

describe("the studio for a business account", () => {
  it("is open", async () => {
    const { router } = open("/en/wholesale/studio", "business");

    expect(await screen.findByRole("heading", studioHeading)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(screen.queryByText("The studio is for business accounts")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en/wholesale/studio");
  });

  it("is open in Spanish", async () => {
    open("/es/wholesale/studio", "business");

    expect(await screen.findByRole("heading", { level: 1, name: "El Estudio de Cacao Corporativo" })).toBeInTheDocument();
  });

  it("is open from the footer link", async () => {
    const { user } = open("/en", "business");

    await user.click(within(screen.getByRole("navigation", { name: "Footer" })).getByRole("link", { name: "Request a quote" }));

    expect(await screen.findByRole("heading", studioHeading)).toBeInTheDocument();
  });

  it("keeps the sign in when the language is switched", async () => {
    const { user, router } = open("/en/wholesale/studio", "business");
    await screen.findByRole("heading", studioHeading);

    await user.click(screen.getByRole("button", { name: "ES, Español" }));

    expect(await screen.findByRole("heading", { level: 1, name: "El Estudio de Cacao Corporativo" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/es/wholesale/studio");
  });
});
