// The sign in, create account, forgot password and reset password pages, against the fake server. Coming back to a page
// after signing in is tested together with the studio, in features/wholesale/components/StudioAccessGuard.test.tsx.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getAuthToken } from "../../lib/authToken";
import { installFakeServer, type FakeCall } from "../../test/fakeServer";
import { renderAt } from "../../test/renderAt";

async function openMain(path: string, server = installFakeServer()) {
  const user = userEvent.setup();
  const result = renderAt(path);
  const page = within(await screen.findByRole("main"));
  return { user, page, server, ...result };
}

const answer = (status: number, code: string, message = "No.", details: unknown[] = []) => new Response(JSON.stringify({ error: { code, message, details } }), { status });

async function fillSignIn(user: ReturnType<typeof userEvent.setup>, page: ReturnType<typeof within>, email = "isabel@example.com", password = "correct horse 42") {
  await user.type(page.getByLabelText(/Email|Correo/), email);
  await user.type(page.getByLabelText(/Password|Contraseña/), password);
}

describe("sign in", () => {
  it("is a plain form with an email, a password and the links to the other pages, and no choice of account type", async () => {
    const { page } = await openMain("/en/account/login");

    expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(page.queryByRole("radio")).not.toBeInTheDocument();
    expect(page.getByLabelText(/Email/)).toHaveAttribute("autocomplete", "email");
    expect(page.getByLabelText(/Password/)).toHaveAttribute("type", "password");
    expect(page.getByLabelText(/Password/)).toHaveAttribute("autocomplete", "current-password");
    expect(page.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", "/en/account/forgot-password");
    expect(page.getByRole("link", { name: "New here? Create an account" })).toHaveAttribute("href", "/en/account/register");
  });

  it("signs a retail account in with the server, keeps the token in memory and goes home", async () => {
    const { user, page, router, server } = await openMain("/en/account/login");

    await fillSignIn(user, page);
    await user.click(page.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { level: 1, name: /Grown in Sunlight/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en");
    expect(server.callsTo("POST", "/api/auth/login")[0].body).toEqual({ email: "isabel@example.com", password: "correct horse 42" });
    expect(getAuthToken()).toMatch(/^token-/);
  });

  it("signs a business account in too", async () => {
    const { user, page, router } = await openMain("/en/account/login");

    await fillSignIn(user, page, "isabel@hacienda.example");
    await user.click(page.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { level: 1, name: /Grown in Sunlight/ });
    expect(router.state.location.pathname).toBe("/en");
  });

  it("trims the email, and the password is sent as it was typed", async () => {
    const { user, page, server } = await openMain("/en/account/login");

    await user.type(page.getByLabelText(/Email/), "  isabel@example.com  ");
    await user.type(page.getByLabelText(/Password/), "correct horse 42");
    await user.click(page.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(server.callsTo("POST", "/api/auth/login")).toHaveLength(1));
    expect(server.callsTo("POST", "/api/auth/login")[0].body).toEqual({ email: "isabel@example.com", password: "correct horse 42" });
  });

  it("says that the email and password do not match, above the form, and keeps what was typed", async () => {
    const { user, page, router } = await openMain("/en/account/login");

    await fillSignIn(user, page, "isabel@example.com", "not the password 1");
    await user.click(page.getByRole("button", { name: "Sign in" }));

    const alert = await page.findByRole("alert");
    expect(alert).toHaveTextContent("That email and password don't match an account.");
    expect(alert).toHaveFocus();
    expect(page.getByLabelText(/Email/)).toHaveValue("isabel@example.com");
    expect(page.getByLabelText(/Password/)).toHaveValue("not the password 1");
    expect(router.state.location.pathname).toBe("/en/account/login");
    expect(getAuthToken()).toBeNull();
  });

  it("says the same for an email that has no account, so the page does not tell who has one", async () => {
    const { user, page } = await openMain("/en/account/login");

    await fillSignIn(user, page, "nobody@example.com", "correct horse 42");
    await user.click(page.getByRole("button", { name: "Sign in" }));

    expect(await page.findByRole("alert")).toHaveTextContent("That email and password don't match an account.");
  });

  it("is written in Spanish for the Spanish address, also the problem", async () => {
    const { user, page } = await openMain("/es/account/login");

    await fillSignIn(user, page, "isabel@example.com", "not the password 1");
    await user.click(page.getByRole("button", { name: "Iniciar sesión" }));

    expect(await page.findByRole("alert")).toHaveTextContent("Ese correo y esa contraseña no corresponden a ninguna cuenta.");
    expect(page.getByRole("link", { name: "¿Olvidaste tu contraseña?" })).toHaveAttribute("href", "/es/account/forgot-password");
  });

  it("does not ask the server when the form has mistakes, and shows them on the fields", async () => {
    const { user, page, server } = await openMain("/en/account/login");

    await user.type(page.getByLabelText(/Email/), "not-an-email");
    await user.click(page.getByRole("button", { name: "Sign in" }));

    expect(server.callsTo("POST", "/api/auth/login")).toHaveLength(0);
    expect(page.getByLabelText(/Email/)).toHaveAttribute("aria-invalid", "true");
    expect(page.getByLabelText(/Password/)).toHaveAttribute("aria-invalid", "true");
    expect(page.getByLabelText(/Email/)).toHaveFocus();
  });

  it.each([
    ["too many tries", () => answer(429, "RATE_LIMITED"), "Too many tries. Please wait a few minutes and try again."],
    ["a locked account", () => answer(429, "TOO_MANY_ATTEMPTS"), "Too many tries. Please wait a few minutes and try again."],
    ["a server that cannot be reached", () => Promise.reject(new TypeError("Failed to fetch")), "We couldn't reach the server. Check your connection and try again."],
    ["a server error", () => answer(500, "INTERNAL_ERROR"), "Something went wrong on our side. Please try again."],
    ["a database that is down", () => answer(503, "DATABASE_UNAVAILABLE"), "Something went wrong on our side. Please try again."],
  ])("explains %s", async (_what, respond, message) => {
    const server = installFakeServer();
    server.override = (call: FakeCall) => (call.path === "/api/auth/login" ? (respond() as unknown as Response) : undefined);
    const { user, page } = await openMain("/en/account/login", server);

    await fillSignIn(user, page);
    await user.click(page.getByRole("button", { name: "Sign in" }));

    expect(await page.findByRole("alert")).toHaveTextContent(message);
  });

  it("shows that it is working, and sends the form once however often the button is pressed", async () => {
    const server = installFakeServer();
    let release: (response: Response) => void = () => {};
    server.override = (call) => (call.path === "/api/auth/login" ? (new Promise<Response>((resolve) => (release = resolve)) as unknown as Response) : undefined);
    const { user, page } = await openMain("/en/account/login", server);
    await fillSignIn(user, page);

    await user.click(page.getByRole("button", { name: "Sign in" }));
    const working = await page.findByRole("button", { name: "Signing in..." });
    await user.click(working);
    await user.click(working);

    expect(server.callsTo("POST", "/api/auth/login")).toHaveLength(1);
    expect(working.closest("form")).toHaveAttribute("aria-busy", "true");
    release(new Response(JSON.stringify({ user: { id: "1", email: "isabel@example.com", name: "Isabel", role: "user", accountType: "retail", preferredLanguage: "en", marketingEmails: false, createdAt: "" }, accessToken: "token-x", expiresIn: 900 }), { status: 200 }));
    await screen.findByRole("heading", { level: 1, name: /Grown in Sunlight/ });
  });

  it("takes the problem away when the next try works", async () => {
    const { user, page } = await openMain("/en/account/login");
    await fillSignIn(user, page, "isabel@example.com", "not the password 1");
    await user.click(page.getByRole("button", { name: "Sign in" }));
    await page.findByRole("alert");

    await user.clear(page.getByLabelText(/Password/));
    await user.type(page.getByLabelText(/Password/), "correct horse 42");
    await user.click(page.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { level: 1, name: /Grown in Sunlight/ });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("goes to the page that was asked for, in the language of the page, whatever language the account has saved", async () => {
    const server = installFakeServer();
    server.accounts[0].preferredLanguage = "es";
    const { user, page, router } = await openMain("/en/account/login?next=%2Fshop", server);

    await fillSignIn(user, page);
    await user.click(page.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { level: 1, name: "The collection" });
    expect(router.state.location.pathname).toBe("/en/shop");
  });
});

describe("create account", () => {
  async function fillRegister(user: ReturnType<typeof userEvent.setup>, page: ReturnType<typeof within>, values: { name?: string; company?: string; email?: string; password?: string } = {}) {
    await user.type(page.getByLabelText(/Full name|Nombre completo/), values.name ?? "Marco Rossi");
    if (values.company) await user.type(page.getByLabelText(/Company|Empresa/), values.company);
    await user.type(page.getByLabelText(/Email|Correo/), values.email ?? "marco@example.com");
    await user.type(page.getByLabelText(/Password|Contraseña/), values.password ?? "correct horse 42");
  }

  it("opens on the retail account, and on the business account for ?type=business, and only for that exact word", async () => {
    const retail = await openMain("/en/account/register");
    expect(retail.page.getByRole("radio", { name: "Retail account" })).toBeChecked();
    expect(retail.page.queryByLabelText(/Company/)).not.toBeInTheDocument();
    retail.unmount();

    const business = await openMain("/en/account/register?type=business");
    expect(business.page.getByRole("radio", { name: "Business account" })).toBeChecked();
    expect(business.page.getByLabelText(/Company/)).toBeInTheDocument();
    business.unmount();

    for (const search of ["?type=retail", "?type=admin", "?type=BUSINESS", "?type=business%20"]) {
      const other = await openMain(`/en/account/register${search}`);
      expect(other.page.getByRole("radio", { name: "Retail account" }), search).toBeChecked();
      other.unmount();
    }
  });

  it("can be switched between the two account types", async () => {
    const { user, page } = await openMain("/en/account/register?type=business");

    await user.click(page.getByRole("radio", { name: "Retail account" }));

    expect(page.queryByLabelText(/Company/)).not.toBeInTheDocument();
  });

  it("makes a retail account: the server gets the name, the email, the password and the language, and the person is home and signed in", async () => {
    const { user, page, router, server } = await openMain("/en/account/register");

    await fillRegister(user, page, { name: "  Marco Rossi " });
    await user.click(page.getByRole("button", { name: "Create account" }));

    await screen.findByRole("heading", { level: 1, name: /Grown in Sunlight/ });
    expect(router.state.location.pathname).toBe("/en");
    expect(server.callsTo("POST", "/api/auth/register")[0].body).toEqual({ name: "Marco Rossi", email: "marco@example.com", password: "correct horse 42", accountType: "retail", preferredLanguage: "en" });
    expect(getAuthToken()).toMatch(/^token-/);
  });

  it("makes a business account with its company, sent as b2b", async () => {
    const { user, page, server } = await openMain("/en/account/register?type=business");

    await fillRegister(user, page, { name: "Isabel Vasquez", company: "  Hacienda Brands ", email: "isabel@newco.example" });
    await user.click(page.getByRole("button", { name: "Create account" }));

    await screen.findByRole("heading", { level: 1, name: /Grown in Sunlight/ });
    expect(server.callsTo("POST", "/api/auth/register")[0].body).toMatchObject({ accountType: "b2b", companyName: "Hacienda Brands" });
  });

  it("gives the account the language of the page", async () => {
    const { user, page, server } = await openMain("/es/account/register");

    await fillRegister(user, page);
    await user.click(page.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(server.callsTo("POST", "/api/auth/register")).toHaveLength(1));
    expect(server.callsTo("POST", "/api/auth/register")[0].body).toMatchObject({ preferredLanguage: "es" });
  });

  it("shows an email that has an account on the email field, not above the form, and moves focus to it", async () => {
    const { user, page, router } = await openMain("/en/account/register");

    await fillRegister(user, page, { email: "isabel@example.com" });
    await user.click(page.getByRole("button", { name: "Create account" }));

    const field = page.getByLabelText(/Email/);
    await waitFor(() => expect(field).toHaveAttribute("aria-invalid", "true"));
    expect(page.getByText("An account with this email already exists. Try signing in instead.")).toBeInTheDocument();
    expect(field).toHaveFocus();
    expect(page.queryByRole("alert", { name: /./ })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en/account/register");
    // and typing another email takes the problem away
    await user.clear(field);
    await user.type(field, "marco@example.com");
    expect(field).not.toHaveAttribute("aria-invalid", "true");
  });

  it.each([
    ["is too short", "abc123"],
    ["has no number", "only letters here"],
    ["has no letter", "1234567890"],
    ["is longer than the server can keep", `a1${"x".repeat(80)}`],
  ])("does not ask the server when the password %s, and says what a password needs", async (_why, password) => {
    const { user, page, server } = await openMain("/en/account/register");

    await fillRegister(user, page, { password });
    await user.click(page.getByRole("button", { name: "Create account" }));

    expect(server.callsTo("POST", "/api/auth/register")).toHaveLength(0);
    expect(page.getByLabelText(/Password/)).toHaveAttribute("aria-invalid", "true");
    expect(page.getByRole("alert")).toHaveTextContent(/Use at (least 10|most 72) characters/);
  });

  it("tells a person what a password needs before they type one", async () => {
    const { page } = await openMain("/en/account/register");

    expect(page.getByText("Use at least 10 characters, with a letter and a number.")).toBeInTheDocument();
    expect(page.getByLabelText(/Password/)).toHaveAttribute("autocomplete", "new-password");
  });

  it("does not sign anyone in when the form has mistakes", async () => {
    const { user, page, server } = await openMain("/en/account/register?type=business");

    await user.type(page.getByLabelText(/Full name/), "Isabel Vasquez");
    await user.click(page.getByRole("button", { name: "Create account" }));

    expect(server.callsTo("POST", "/api/auth/register")).toHaveLength(0);
    expect(page.getByLabelText(/Company/)).toHaveAttribute("aria-invalid", "true");
    expect(getAuthToken()).toBeNull();
  });

  it("puts the fields that the server names on those fields, in our own words", async () => {
    const server = installFakeServer();
    server.override = (call) =>
      call.path === "/api/auth/register"
        ? answer(400, "VALIDATION_ERROR", "The server's English words.", [
            { field: "name", message: "x" },
            { field: "companyName", message: "x" },
            { field: "password", message: "x" },
          ])
        : undefined;
    const { user, page } = await openMain("/en/account/register?type=business", server);

    await fillRegister(user, page, { company: "Hacienda Brands" });
    await user.click(page.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(page.getByLabelText(/Full name/)).toHaveAttribute("aria-invalid", "true"));
    expect(page.getByLabelText(/Company/)).toHaveAttribute("aria-invalid", "true");
    expect(page.getByLabelText(/Password/)).toHaveAttribute("aria-invalid", "true");
    expect(page.queryByText("The server's English words.")).not.toBeInTheDocument();
  });

  it.each([
    ["too many accounts from this address", () => answer(429, "RATE_LIMITED"), "Too many tries. Please wait a few minutes and try again."],
    ["a server that cannot be reached", () => Promise.reject(new TypeError("Failed to fetch")), "We couldn't reach the server. Check your connection and try again."],
    ["a server error", () => answer(500, "INTERNAL_ERROR"), "Something went wrong on our side. Please try again."],
  ])("explains %s above the form, and keeps what was typed", async (_what, respond, message) => {
    const server = installFakeServer();
    server.override = (call) => (call.path === "/api/auth/register" ? (respond() as unknown as Response) : undefined);
    const { user, page } = await openMain("/en/account/register", server);

    await fillRegister(user, page);
    await user.click(page.getByRole("button", { name: "Create account" }));

    const alert = await page.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(alert).toHaveFocus();
    expect(page.getByLabelText(/Full name/)).toHaveValue("Marco Rossi");
  });

  it("sends the form once however often the button is pressed", async () => {
    const server = installFakeServer();
    server.override = (call) => (call.path === "/api/auth/register" ? (new Promise<Response>(() => {}) as unknown as Response) : undefined);
    const { user, page } = await openMain("/en/account/register", server);
    await fillRegister(user, page);

    await user.click(page.getByRole("button", { name: "Create account" }));
    const working = await page.findByRole("button", { name: "Creating your account..." });
    await user.click(working);

    expect(server.callsTo("POST", "/api/auth/register")).toHaveLength(1);
  });
});

describe("forgot password", () => {
  it("asks for an email, sends it, and shows the same message whether or not the address has an account", async () => {
    for (const email of ["isabel@example.com", "nobody@example.com"]) {
      const { user, page, server, unmount } = await openMain("/en/account/forgot-password");

      await user.type(page.getByLabelText(/Email/), email);
      await user.click(page.getByRole("button", { name: "Send reset link" }));

      expect(await page.findByText(`If there is an account for ${email}, a link to reset the password is on its way. It works once, for one hour.`)).toBeInTheDocument();
      expect(server.callsTo("POST", "/api/auth/forgot-password")[0].body).toEqual({ email });
      expect(page.queryByLabelText(/Email/)).not.toBeInTheDocument();
      unmount();
    }
  });

  it("moves focus to the message, and has a link back to sign in", async () => {
    const { user, page } = await openMain("/en/account/forgot-password");

    await user.type(page.getByLabelText(/Email/), "isabel@example.com");
    await user.click(page.getByRole("button", { name: "Send reset link" }));

    expect(await page.findByText(/If there is an account/)).toHaveFocus();
    expect(page.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/en/account/login");
  });

  it("does not ask the server for an email that is not an email", async () => {
    const { user, page, server } = await openMain("/en/account/forgot-password");

    await user.type(page.getByLabelText(/Email/), "nope");
    await user.click(page.getByRole("button", { name: "Send reset link" }));

    expect(server.callsTo("POST", "/api/auth/forgot-password")).toHaveLength(0);
    expect(page.getByLabelText(/Email/)).toHaveAttribute("aria-invalid", "true");
  });

  it("says when there were too many requests, or the server cannot be reached", async () => {
    const server = installFakeServer();
    server.override = () => answer(429, "RATE_LIMITED") as unknown as Response;
    const { user, page } = await openMain("/en/account/forgot-password", server);

    await user.type(page.getByLabelText(/Email/), "isabel@example.com");
    await user.click(page.getByRole("button", { name: "Send reset link" }));

    expect(await page.findByRole("alert")).toHaveTextContent("Too many tries. Please wait a few minutes and try again.");
    expect(page.getByLabelText(/Email/)).toHaveValue("isabel@example.com");
  });

  it("is written in Spanish for the Spanish address", async () => {
    const { user, page } = await openMain("/es/account/forgot-password");

    expect(page.getByRole("heading", { level: 1, name: "Restablece tu contraseña" })).toBeInTheDocument();
    await user.type(page.getByLabelText(/Correo/), "isabel@example.com");
    await user.click(page.getByRole("button", { name: "Enviar enlace" }));

    expect(await page.findByText(/Si existe una cuenta para isabel@example.com/)).toBeInTheDocument();
    expect(document.title).toBe("Restablece tu contraseña | SolCacao");
  });
});

describe("reset password", () => {
  const token = "A".repeat(43);

  it("chooses a new password with the token of the link, and then offers to sign in", async () => {
    const server = installFakeServer();
    server.resetTokens.add(token);
    const { user, page } = await openMain(`/en/account/reset-password?token=${token}`, server);

    await user.type(page.getByLabelText(/New password/), "brand new pass 7");
    await user.click(page.getByRole("button", { name: "Save new password" }));

    expect(await page.findByText("Your password was changed. You can sign in with it now.")).toHaveFocus();
    expect(server.callsTo("POST", "/api/auth/reset-password")[0].body).toEqual({ token, password: "brand new pass 7" });
    expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/en/account/login");
  });

  it("says that the link is not valid, without showing the form, when the token is missing or of the wrong shape", async () => {
    for (const search of ["", "?token=", "?token=short", `?token=${"A".repeat(44)}`, `?token=${"A".repeat(42)}%20`]) {
      const { page, server, unmount } = await openMain(`/en/account/reset-password${search}`);

      expect(await page.findByRole("alert"), search).toHaveTextContent("This reset link is not valid, or it has expired.");
      expect(page.queryByLabelText(/New password/), search).not.toBeInTheDocument();
      expect(page.getByRole("link", { name: "Ask for a new link" })).toHaveAttribute("href", "/en/account/forgot-password");
      expect(server.calls).toHaveLength(0);
      unmount();
    }
  });

  it("says that the link is not valid when the server does not know the token, or it was used already", async () => {
    const { user, page } = await openMain(`/en/account/reset-password?token=${token}`);

    await user.type(page.getByLabelText(/New password/), "brand new pass 7");
    await user.click(page.getByRole("button", { name: "Save new password" }));

    expect(await page.findByRole("alert")).toHaveTextContent("This reset link is not valid, or it has expired.");
    expect(page.getByRole("link", { name: "Ask for a new link" })).toBeInTheDocument();
  });

  it("holds the new password to the rules, here and on the server, and keeps the link usable", async () => {
    const server = installFakeServer();
    server.resetTokens.add(token);
    const { user, page } = await openMain(`/en/account/reset-password?token=${token}`, server);

    await user.type(page.getByLabelText(/New password/), "short1");
    await user.click(page.getByRole("button", { name: "Save new password" }));

    expect(server.callsTo("POST", "/api/auth/reset-password")).toHaveLength(0);
    expect(page.getByLabelText(/New password/)).toHaveAttribute("aria-invalid", "true");

    await user.clear(page.getByLabelText(/New password/));
    await user.type(page.getByLabelText(/New password/), "a better pass 12");
    await user.click(page.getByRole("button", { name: "Save new password" }));
    expect(await page.findByText(/Your password was changed/)).toBeInTheDocument();
  });

  it("shows a password that the server refuses on the field, in our own words", async () => {
    const server = installFakeServer();
    server.override = (call) => (call.path === "/api/auth/reset-password" ? answer(400, "VALIDATION_ERROR", "Too easy.", [{ field: "password", message: "Too easy." }]) : undefined);
    const { user, page } = await openMain(`/en/account/reset-password?token=${token}`, server);

    await user.type(page.getByLabelText(/New password/), "password12345");
    await user.click(page.getByRole("button", { name: "Save new password" }));

    await waitFor(() => expect(page.getByLabelText(/New password/)).toHaveAttribute("aria-invalid", "true"));
    expect(page.queryByText("Too easy.")).not.toBeInTheDocument();
  });

  it("explains a server that cannot be reached, and keeps what was typed", async () => {
    const server = installFakeServer();
    server.override = () => Promise.reject(new TypeError("Failed to fetch")) as unknown as Response;
    const { user, page } = await openMain(`/en/account/reset-password?token=${token}`, server);

    await user.type(page.getByLabelText(/New password/), "brand new pass 7");
    await user.click(page.getByRole("button", { name: "Save new password" }));

    expect(await page.findByRole("alert")).toHaveTextContent("We couldn't reach the server");
    expect(page.getByLabelText(/New password/)).toHaveValue("brand new pass 7");
  });

  it("is written in Spanish for the Spanish address", async () => {
    const server = installFakeServer();
    server.resetTokens.add(token);
    const { user, page } = await openMain(`/es/account/reset-password?token=${token}`, server);

    await user.type(page.getByLabelText(/Contraseña nueva/), "brand new pass 7");
    await user.click(page.getByRole("button", { name: "Guardar contraseña nueva" }));

    expect(await page.findByText("Se cambió tu contraseña. Ya puedes iniciar sesión con ella.")).toBeInTheDocument();
    expect(page.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/es/account/login");
  });
});
