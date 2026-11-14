import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getAuthToken } from "../../lib/authToken";
import { businessAccount, installFakeServer, retailAccount, type FakeAccount } from "../../test/fakeServer";
import { renderAt, sessionFor } from "../../test/renderAt";

// opens the profile of an account of the fake server, signed in
async function openProfile(account: FakeAccount = { ...retailAccount, phone: "+1 512 555 0184" }, path = "/en/profile") {
  const user = userEvent.setup();
  const server = installFakeServer([account]);
  const result = renderAt(path, { user: sessionFor(server, server.accounts[0]) });
  await screen.findByRole("heading", { level: 1 });
  return { user, server, account: server.accounts[0], ...result };
}

const answer = (status: number, code: string, message = "No.", details: unknown[] = []) => new Response(JSON.stringify({ error: { code, message, details } }), { status });

describe("the profile page", () => {
  it("is read only at the start, with the details of the account", async () => {
    await openProfile();

    expect(screen.getByRole("heading", { level: 1, name: "Your profile" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Isabel Vasquez");
    expect(screen.getByLabelText(/Full name/)).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Email address")).toHaveValue("isabel@example.com");
    expect(screen.getByLabelText("Phone")).toHaveValue("+1 512 555 0184");
    expect(screen.getByRole("textbox", { name: "Language" })).toHaveValue("English");
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("shows the person at the side: the initials, the name, the email and the type of account, and no picture", async () => {
    await openProfile();
    const side = screen.getByRole("complementary", { name: "Your profile" });

    expect(within(side).getByText("IV")).toBeInTheDocument();
    expect(within(side).getByText("Isabel Vasquez")).toBeInTheDocument();
    expect(within(side).getByText("isabel@example.com")).toBeInTheDocument();
    expect(within(side).getByText("Retail account")).toBeInTheDocument();
    expect(within(side).getByText(/^Account SC-/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change photo" })).not.toBeInTheDocument();
  });

  it("says since when the person is a member, from the date of the account", async () => {
    await openProfile();

    expect(screen.getByText("Member since 2026")).toBeInTheDocument();
  });

  it("asks nothing of the server just to show a retail account", async () => {
    const { server } = await openProfile();

    // the cart of the page is read as on every page, and the account is not asked for
    expect(server.calls.filter((call) => !call.path.startsWith("/api/cart"))).toEqual([]);
  });
});

describe("editing the details", () => {
  it("saves with the server, and shows the saved values, the message, and focus on the Edit button again", async () => {
    const { user, server } = await openProfile();

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    const phone = screen.getByLabelText("Phone");
    expect(phone).not.toHaveAttribute("readonly");
    await user.clear(phone);
    await user.type(phone, "+1 512 555 0000");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Edit profile" })).toHaveFocus());
    expect(server.callsTo("PATCH", "/api/users/me")[0].body).toEqual({ name: "Isabel Vasquez", phone: "+1 512 555 0000", preferredLanguage: "en" });
    expect(screen.getByLabelText("Phone")).toHaveValue("+1 512 555 0000");
    expect(screen.getByLabelText("Phone")).toHaveAttribute("readonly");
    expect(within(screen.getByRole("main")).getByText("Your changes were saved.")).toBeInTheDocument();
    expect(server.accounts[0].phone).toBe("+1 512 555 0000");
  });

  it("sends the token of the signed in person, and never the email", async () => {
    const { user, server } = await openProfile();

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    await user.type(screen.getByLabelText("Phone"), "0");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(server.callsTo("PATCH", "/api/users/me")).toHaveLength(1));
    const call = server.callsTo("PATCH", "/api/users/me")[0];
    expect(call.headers.authorization).toBe("Bearer token-0");
    expect(call.body).not.toHaveProperty("email");
  });

  it("keeps the email read only, also while editing, and says why", async () => {
    const { user } = await openProfile();

    await user.click(screen.getByRole("button", { name: "Edit profile" }));

    expect(screen.getByLabelText("Email address")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription("This is the email you signed up with. It can't be changed here.");
  });

  it("puts the keyboard in the first field you can change, when the form opens", async () => {
    const { user } = await openProfile();

    await user.click(screen.getByRole("button", { name: "Edit profile" }));

    await waitFor(() => expect(screen.getByLabelText(/Full name/)).toHaveFocus());
  });

  it("changes the name of the person everywhere on the page", async () => {
    const { user } = await openProfile();

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    await user.clear(screen.getByLabelText(/Full name/));
    await user.type(screen.getByLabelText(/Full name/), "Isabel V.");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(within(screen.getByRole("complementary", { name: "Your profile" })).getByText("Isabel V.")).toBeInTheDocument());
  });

  it("takes the phone away when it is emptied", async () => {
    const { user, server } = await openProfile();

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    await user.clear(screen.getByLabelText("Phone"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(server.callsTo("PATCH", "/api/users/me")).toHaveLength(1));
    expect(server.callsTo("PATCH", "/api/users/me")[0].body).toMatchObject({ phone: "" });
    await waitFor(() => expect(server.accounts[0].phone).toBeUndefined());
  });

  it("saves the language of the emails", async () => {
    const { user, server } = await openProfile();

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    await user.click(screen.getByRole("radio", { name: "Spanish" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Language" })).toHaveValue("Spanish"));
    expect(server.callsTo("PATCH", "/api/users/me")[0].body).toMatchObject({ preferredLanguage: "es" });
  });

  it("shows an error and does not ask the server when a field is not valid", async () => {
    const { user, server } = await openProfile();

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    const name = screen.getByLabelText(/Full name/);
    await user.clear(name);
    await user.type(screen.getByLabelText("Phone"), "call me");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("This field is required.");
    expect(name).toHaveFocus();
    expect(screen.getByLabelText("Phone")).toHaveAttribute("aria-invalid", "true");
    expect(server.callsTo("PATCH", "/api/users/me")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("puts a problem that only the server finds on its field, in our words", async () => {
    const { user, server } = await openProfile();
    server.override = (call) => (call.method === "PATCH" && call.path === "/api/users/me" ? answer(400, "VALIDATION_ERROR", "Bad phone.", [{ field: "phone", message: "Bad phone." }]) : undefined);

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    await user.type(screen.getByLabelText("Phone"), "0");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.getByLabelText("Phone")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByLabelText("Phone")).toHaveAccessibleDescription("Enter a valid phone number.");
    expect(screen.queryByText("Bad phone.")).not.toBeInTheDocument();
  });

  it.each([
    ["a server error", () => answer(500, "INTERNAL_ERROR"), "We couldn't save your changes. Please try again."],
    ["a server that cannot be reached", () => Promise.reject(new TypeError("Failed to fetch")), "We couldn't reach the server. Check your connection and try again."],
  ])("says that %s, keeps the form open and keeps what was typed", async (_what, respond, message) => {
    const { user, server } = await openProfile();
    server.override = (call) => (call.method === "PATCH" ? (respond() as unknown as Response) : undefined);

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    await user.type(screen.getByLabelText("Phone"), "9");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toHaveValue("+1 512 555 01849");
  });

  it("puts the old values back when the form is cancelled, and asks nothing of the server", async () => {
    const { user, server } = await openProfile();

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    await user.type(screen.getByLabelText("Phone"), " ext 5");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Edit profile" })).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toHaveValue("+1 512 555 0184");
    expect(server.callsTo("PATCH", "/api/users/me")).toHaveLength(0);
  });
});

describe("the password", () => {
  async function openPanel(account?: FakeAccount) {
    const opened = await openProfile(account);
    await opened.user.click(screen.getByRole("button", { name: /Change password/ }));
    return opened;
  }

  it("is changed with the current and the new one, and the page gets a new token for this device", async () => {
    const { user, server } = await openPanel();
    expect(getAuthToken()).toBe("token-0");

    await user.type(screen.getByLabelText(/Current password/), "correct horse 42");
    await user.type(screen.getByLabelText(/New password/), "brand new pass 7");
    await user.click(screen.getByRole("button", { name: "Change password", description: "" }));

    await waitFor(() => expect(within(screen.getByRole("main")).getByText("Your password was changed. Your other devices were signed out.")).toBeInTheDocument());
    expect(server.callsTo("PATCH", "/api/users/me/password")[0].body).toEqual({ currentPassword: "correct horse 42", newPassword: "brand new pass 7" });
    expect(server.accounts[0].password).toBe("brand new pass 7");
    expect(getAuthToken()).toMatch(/^token-[1-9]/);
    expect(screen.queryByLabelText(/Current password/)).not.toBeInTheDocument();
  });

  it("says that the current password is not right, on that field, and keeps the panel open", async () => {
    const { user } = await openPanel();

    await user.type(screen.getByLabelText(/Current password/), "not the one 99");
    await user.type(screen.getByLabelText(/New password/), "brand new pass 7");
    await user.click(screen.getByRole("button", { name: "Change password", description: "" }));

    await waitFor(() => expect(screen.getByLabelText(/Current password/)).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByLabelText(/Current password/)).toHaveAccessibleDescription("That isn't your current password.");
    expect(screen.getByLabelText(/Current password/)).toHaveFocus();
  });

  it("holds the new password to the rules, and does not ask the server", async () => {
    const { user, server } = await openPanel();

    await user.type(screen.getByLabelText(/Current password/), "correct horse 42");
    await user.type(screen.getByLabelText(/New password/), "short1");
    await user.click(screen.getByRole("button", { name: "Change password", description: "" }));

    expect(screen.getByLabelText(/New password/)).toHaveAttribute("aria-invalid", "true");
    expect(server.callsTo("PATCH", "/api/users/me/password")).toHaveLength(0);
  });

  it("does not take the same password again, and does not ask the server", async () => {
    const { user, server } = await openPanel();

    await user.type(screen.getByLabelText(/Current password/), "correct horse 42");
    await user.type(screen.getByLabelText(/New password/), "correct horse 42");
    await user.click(screen.getByRole("button", { name: "Change password", description: "" }));

    await waitFor(() => expect(screen.getByLabelText(/New password/)).toHaveAccessibleDescription(/Your new password has to be different from the current one\./));
    expect(server.callsTo("PATCH", "/api/users/me/password")).toHaveLength(0);
  });

  it("says when there were too many wrong tries", async () => {
    const { user, server } = await openPanel();
    server.override = (call) => (call.path === "/api/users/me/password" ? answer(429, "RATE_LIMITED") : undefined);

    await user.type(screen.getByLabelText(/Current password/), "correct horse 42");
    await user.type(screen.getByLabelText(/New password/), "brand new pass 7");
    await user.click(screen.getByRole("button", { name: "Change password", description: "" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many tries. Please wait a few minutes and try again.");
  });

  it("is a panel that opens and closes, with its state told to a screen reader", async () => {
    const { user } = await openProfile();
    const button = screen.getByRole("button", { name: /Change password/ });
    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.click(button);

    expect(screen.queryByLabelText(/Current password/)).not.toBeInTheDocument();
  });
});

describe("the notifications switch", () => {
  it("saves the choice with the server, and shows it", async () => {
    const { user, server } = await openProfile();
    const toggle = screen.getByRole("switch", { name: "Notification preferences" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);

    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
    expect(server.callsTo("PATCH", "/api/users/me")[0].body).toEqual({ marketingEmails: true });
    expect(server.accounts[0].marketingEmails).toBe(true);

    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));
  });

  it("stays as it was, and says so, when the server could not save it", async () => {
    const { user, server } = await openProfile();
    server.override = (call) => (call.method === "PATCH" ? answer(500, "INTERNAL_ERROR") : undefined);
    const toggle = screen.getByRole("switch", { name: "Notification preferences" });

    await user.click(toggle);

    expect(await screen.findByText("We couldn't save that. Please try again.")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});

describe("logging out", () => {
  it("ends the sign in on the server, forgets the token and goes to the sign in page", async () => {
    const { user, server, router } = await openProfile();

    await user.click(screen.getByRole("button", { name: /Log out/ }));

    await screen.findByRole("heading", { level: 1, name: "Sign in" });
    expect(router.state.location.pathname).toBe("/en/account/login");
    expect(server.callsTo("POST", "/api/auth/logout")).toHaveLength(1);
    expect(getAuthToken()).toBeNull();
  });

  it("is the same in Spanish", async () => {
    const { user, router } = await openProfile(undefined, "/es/profile");

    await user.click(screen.getByRole("button", { name: /Cerrar sesión/ }));

    await screen.findByRole("heading", { level: 1, name: "Iniciar sesión" });
    expect(router.state.location.pathname).toBe("/es/account/login");
  });
});

describe("somebody who is not signed in", () => {
  it("is sent to the sign in page, which brings them back", async () => {
    installFakeServer();
    const { router } = renderAt("/en/profile");

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en/account/login");
    expect(router.state.location.search).toBe("?next=%2Fprofile");
    expect(screen.queryByRole("heading", { name: "Your profile" })).not.toBeInTheDocument();
  });
});

describe("a business account", () => {
  const business = { ...businessAccount, taxId: "12-3456789", industry: "Hospitality" };

  it("shows its business details from the server, with the verification and what it means", async () => {
    const { server } = await openProfile(business);

    const section = within(await screen.findByRole("region", { name: "Business details" }));
    expect(await section.findByText("Hacienda Brands")).toBeInTheDocument();
    expect(section.getByText("12-3456789")).toBeInTheDocument();
    expect(section.getByText("Hospitality")).toBeInTheDocument();
    expect(section.getByText("Pending")).toBeInTheDocument();
    expect(section.getByText("Our team will check your business. This can take up to one business day.")).toBeInTheDocument();
    expect(server.callsTo("GET", "/api/users/me/b2b-profile")).toHaveLength(1);
  });

  it("says Verified, in words, when the team has verified it", async () => {
    await openProfile({ ...business, verificationStatus: "verified" });

    const section = within(await screen.findByRole("region", { name: "Business details" }));
    expect(await section.findByText("Verified")).toBeInTheDocument();
    expect(section.getByText("Your business was checked and approved.")).toBeInTheDocument();
  });

  it("says that a detail is not added yet, instead of showing an empty box", async () => {
    await openProfile({ ...businessAccount });

    const section = within(await screen.findByRole("region", { name: "Business details" }));
    expect(await section.findAllByText("Not added yet")).toHaveLength(2);
  });

  it("saves new details with the server, and the page shows the new company", async () => {
    const { user, server } = await openProfile(business);
    const section = within(await screen.findByRole("region", { name: "Business details" }));
    await user.click(await section.findByRole("button", { name: "Edit business details" }));

    const company = section.getByLabelText(/Company name/);
    await user.clear(company);
    await user.type(company, "Hacienda Brands LLC");
    await user.clear(section.getByLabelText("Tax id"));
    await user.click(section.getByRole("button", { name: "Save business details" }));

    expect(await section.findByText("Your business details were saved.")).toBeInTheDocument();
    expect(server.callsTo("PUT", "/api/users/me/b2b-profile")[0].body).toEqual({ companyName: "Hacienda Brands LLC", taxId: "", industry: "Hospitality" });
    expect(section.getByText("Hacienda Brands LLC")).toBeInTheDocument();
    expect(within(screen.getByRole("complementary", { name: "Your profile" })).getByText("Hacienda Brands LLC")).toBeInTheDocument();
    await waitFor(() => expect(section.getByRole("button", { name: "Edit business details" })).toHaveFocus());
  });

  it("cannot be used to change the verification: there is no way to send it", async () => {
    const { user, server } = await openProfile(business);
    const section = within(await screen.findByRole("region", { name: "Business details" }));
    await user.click(await section.findByRole("button", { name: "Edit business details" }));
    await user.click(section.getByRole("button", { name: "Save business details" }));

    await waitFor(() => expect(server.callsTo("PUT", "/api/users/me/b2b-profile")).toHaveLength(1));
    expect(server.callsTo("PUT", "/api/users/me/b2b-profile")[0].body).not.toHaveProperty("verificationStatus");
    expect(section.queryByLabelText(/Verification/)).not.toBeInTheDocument();
  });

  it("needs a company, and does not ask the server without one", async () => {
    const { user, server } = await openProfile(business);
    const section = within(await screen.findByRole("region", { name: "Business details" }));
    await user.click(await section.findByRole("button", { name: "Edit business details" }));

    await user.clear(section.getByLabelText(/Company name/));
    await user.click(section.getByRole("button", { name: "Save business details" }));

    expect(section.getByLabelText(/Company name/)).toHaveAttribute("aria-invalid", "true");
    expect(server.callsTo("PUT", "/api/users/me/b2b-profile")).toHaveLength(0);
  });

  it("says that the details could not be loaded, and loads them again on request", async () => {
    const user = userEvent.setup();
    const server = installFakeServer([business]);
    let fail = true;
    server.override = (call) => (call.method === "GET" && call.path === "/api/users/me/b2b-profile" && fail ? answer(500, "INTERNAL_ERROR") : undefined);
    renderAt("/en/profile", { user: sessionFor(server, server.accounts[0]) });
    const section = within(await screen.findByRole("region", { name: "Business details" }));

    expect(await section.findByRole("alert")).toHaveTextContent("We couldn't load your business details.");
    fail = false;
    await user.click(section.getByRole("button", { name: "Try again" }));

    expect(await section.findByText("Hacienda Brands")).toBeInTheDocument();
    expect(section.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the company in the summary at the side, and a link to the quote requests", async () => {
    await openProfile(business);

    expect(within(screen.getByRole("complementary", { name: "Your profile" })).getByText("Business account")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /My quote requests/ })).toHaveAttribute("href", "/en/account/requests");
  });

  it("is in Spanish on the Spanish address", async () => {
    await openProfile(business, "/es/profile");

    const section = within(await screen.findByRole("region", { name: "Datos de la empresa" }));
    expect(await section.findByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mis solicitudes de cotización/ })).toHaveAttribute("href", "/es/account/requests");
  });
});

describe("a retail account", () => {
  it("has no business details and no link to quote requests", async () => {
    const { server } = await openProfile();

    expect(screen.queryByRole("region", { name: "Business details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /My quote requests/ })).not.toBeInTheDocument();
    expect(server.callsTo("GET", "/api/users/me/b2b-profile")).toHaveLength(0);
  });
});

describe("the way to the addresses", () => {
  it("is a link in the language of the page", async () => {
    await openProfile();
    expect(screen.getByRole("link", { name: /Manage addresses/ })).toHaveAttribute("href", "/en/profile/addresses");
  });
});

describe("the profile page in Spanish", () => {
  it("is written in Spanish, also the member line", async () => {
    await openProfile(undefined, "/es/profile");

    expect(screen.getByRole("heading", { level: 1, name: "Tu perfil" })).toBeInTheDocument();
    expect(screen.getByText("Miembro desde 2026")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Idioma" })).toHaveValue("Inglés");
    expect(screen.getByRole("button", { name: "Editar perfil" })).toBeInTheDocument();
  });

  it("follows the language switch without losing the page", async () => {
    const { user, router } = await openProfile();

    await user.click(screen.getByRole("button", { name: "ES, Español" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Tu perfil" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/es/profile");
  });

  it("saves the language that was chosen with the account, when somebody is signed in", async () => {
    const { user, server } = await openProfile();

    await user.click(screen.getByRole("button", { name: "ES, Español" }));

    await waitFor(() => expect(server.callsTo("PATCH", "/api/users/me")).toHaveLength(1));
    expect(server.callsTo("PATCH", "/api/users/me")[0].body).toEqual({ preferredLanguage: "es" });
    expect(server.accounts[0].preferredLanguage).toBe("es");
  });

  it("does not ask the server again for the language it already has", async () => {
    const { user, server } = await openProfile();

    await user.click(screen.getByRole("button", { name: "EN, English" }));

    expect(server.callsTo("PATCH", "/api/users/me")).toHaveLength(0);
  });
});

describe("the account icon", () => {
  it("leads to the profile page", async () => {
    const user = userEvent.setup();
    installFakeServer();
    const server = installFakeServer([retailAccount]);
    renderAt("/en", { user: sessionFor(server, server.accounts[0]) });
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getByRole("link", { name: "View profile" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Your profile" })).toBeInTheDocument();
  });
});
