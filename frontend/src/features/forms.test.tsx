import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installFakeServer } from "../test/fakeServer";
import { renderAt } from "../test/renderAt";

// the footer has a newsletter form too, so the queries only look inside the page content
async function openPage(path: string) {
  const user = userEvent.setup();
  const result = renderAt(path);
  const page = within(await screen.findByRole("main"));
  return { user, page, ...result };
}

describe("contact form", () => {
  it("shows an error under each empty field and focuses the first one", async () => {
    const { user, page } = await openPage("/en/contact");

    await user.click(page.getByRole("button", { name: "Send message" }));

    const name = page.getByLabelText(/Name/);
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("This field is required.");
    expect(name).toHaveFocus();
    expect(page.getByLabelText(/Email/)).toHaveAttribute("aria-invalid", "true");
    expect(page.getByLabelText(/Message/)).toHaveAttribute("aria-invalid", "true");
  });

  it("explains a wrong email address", async () => {
    const { user, page } = await openPage("/en/contact");

    const email = page.getByLabelText(/Email/);
    await user.type(email, "not-an-email");
    await user.tab();

    expect(email).toHaveAccessibleDescription(/valid email address/);
  });

  it("has the category as a radio group", async () => {
    const { user, page } = await openPage("/en/contact");

    expect(page.getByRole("group", { name: "Category" })).toBeInTheDocument();
    expect(page.getByRole("radio", { name: "General" })).toBeChecked();

    await user.click(page.getByRole("radio", { name: "Support" }));
    expect(page.getByRole("radio", { name: "Support" })).toBeChecked();
  });

  it("confirms the message when everything is filled in, and sends it to the server", async () => {
    const server = installFakeServer();
    const { user, page } = await openPage("/en/contact");

    await user.type(page.getByLabelText(/Name/), "  Isabel ");
    await user.type(page.getByLabelText(/Email/), "isabel@example.com");
    await user.type(page.getByLabelText(/Message/), "Do you ship to Canada?");
    await user.click(page.getByRole("radio", { name: "Support" }));
    await user.click(page.getByRole("button", { name: "Send message" }));

    expect(await page.findByRole("heading", { name: "Message received." })).toHaveFocus();
    expect(server.callsTo("POST", "/api/inquiries")[0].body).toEqual({
      category: "support",
      name: "Isabel",
      email: "isabel@example.com",
      message: "Do you ship to Canada?",
    });
  });

  it("does not say that the message was received when the server could not be reached, and keeps what was written", async () => {
    const server = installFakeServer();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => (String(input).startsWith("/api/inquiries") ? Promise.reject(new TypeError("Failed to fetch")) : server.handle(input, init))));
    const { user, page } = await openPage("/en/contact");

    await user.type(page.getByLabelText(/Name/), "Isabel");
    await user.type(page.getByLabelText(/Email/), "isabel@example.com");
    await user.type(page.getByLabelText(/Message/), "Do you ship to Canada?");
    await user.click(page.getByRole("button", { name: "Send message" }));

    const alert = await page.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't reach the server, so your message was not sent.");
    expect(alert).toHaveFocus();
    expect(page.queryByRole("heading", { name: "Message received." })).not.toBeInTheDocument();
    expect(page.getByLabelText(/Message/)).toHaveValue("Do you ship to Canada?");
  });

  it("tells the person when they have sent too many messages", async () => {
    const server = installFakeServer();
    server.override = (call) =>
      call.path === "/api/inquiries"
        ? new Response(JSON.stringify({ error: { code: "RATE_LIMITED", message: "Slow down.", details: [] } }), { status: 429 })
        : undefined;
    const { user, page } = await openPage("/en/contact");

    await user.type(page.getByLabelText(/Name/), "Isabel");
    await user.type(page.getByLabelText(/Email/), "isabel@example.com");
    await user.type(page.getByLabelText(/Message/), "Do you ship to Canada?");
    await user.click(page.getByRole("button", { name: "Send message" }));

    expect(await page.findByRole("alert")).toHaveTextContent("You have sent a lot of messages.");
  });

  it("shows a problem that the server finds on the field it names", async () => {
    const server = installFakeServer();
    server.override = (call) =>
      call.path === "/api/inquiries"
        ? new Response(JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "Check the form.", details: [{ field: "email", message: "bad" }] } }), { status: 400 })
        : undefined;
    const { user, page } = await openPage("/en/contact");

    await user.type(page.getByLabelText(/Name/), "Isabel");
    await user.type(page.getByLabelText(/Email/), "isabel@example.com");
    await user.type(page.getByLabelText(/Message/), "Do you ship to Canada?");
    await user.click(page.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(page.getByLabelText(/Email/)).toHaveAttribute("aria-invalid", "true"));
    expect(page.getByLabelText(/Email/)).toHaveAccessibleDescription(/valid email address/);
    expect(page.getByLabelText(/Email/)).toHaveFocus();
  });

  it("asks for a name of at least two characters, like the server does", async () => {
    const { user, page } = await openPage("/en/contact");

    await user.type(page.getByLabelText(/Name/), "I");
    await user.click(page.getByRole("button", { name: "Send message" }));

    expect(page.getByLabelText(/Name/)).toHaveAccessibleDescription("Use at least 2 characters.");
  });

  it("has a WhatsApp link that opens in a new tab and says so", async () => {
    const { page } = await openPage("/en/contact");

    const link = page.getByRole("link", { name: /WhatsApp/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAccessibleName(/opens in a new tab/);
  });
});

describe("newsletter box in the footer", () => {
  const footer = () => within(screen.getByRole("contentinfo"));

  it("subscribes the address, says so, and empties the box", async () => {
    const server = installFakeServer();
    const { user } = await openPage("/en");

    await user.type(footer().getByLabelText(/Email address/), "isabel@example.com");
    await user.click(footer().getByRole("button", { name: "Subscribe" }));

    expect(await footer().findByText(/Thanks for subscribing/)).toBeInTheDocument();
    expect(server.callsTo("POST", "/api/inquiries")[0].body).toEqual({ category: "newsletter", email: "isabel@example.com" });
    expect(footer().getByLabelText(/Email address/)).toHaveValue("");
  });

  it("checks the address before it asks the server", async () => {
    const server = installFakeServer();
    const { user } = await openPage("/en");

    await user.type(footer().getByLabelText(/Email address/), "not-an-email");
    await user.click(footer().getByRole("button", { name: "Subscribe" }));

    expect(footer().getByLabelText(/Email address/)).toHaveAttribute("aria-invalid", "true");
    expect(server.callsTo("POST", "/api/inquiries")).toHaveLength(0);
  });

  it("does not say that the person subscribed when it did not work", async () => {
    const server = installFakeServer();
    server.override = (call) =>
      call.path === "/api/inquiries" ? new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Down.", details: [] } }), { status: 500 }) : undefined;
    const { user } = await openPage("/en");

    await user.type(footer().getByLabelText(/Email address/), "isabel@example.com");
    await user.click(footer().getByRole("button", { name: "Subscribe" }));

    expect(await footer().findByRole("alert")).toHaveTextContent("Something went wrong, so your message was not sent.");
    expect(footer().queryByText(/Thanks for subscribing/)).not.toBeInTheDocument();
    expect(footer().getByLabelText(/Email address/)).toHaveValue("isabel@example.com");
  });
});

describe("account forms", () => {
  it("sign in checks the email and the password", async () => {
    const { user, page } = await openPage("/en/account/login");

    await user.click(page.getByRole("button", { name: "Sign in" }));

    expect(page.getByLabelText(/Email/)).toHaveAttribute("aria-invalid", "true");
    expect(page.getByLabelText(/Password/)).toHaveAttribute("aria-invalid", "true");
  });

  it("sign in goes to the home page when the form is valid and the server accepts it", async () => {
    installFakeServer();
    const { user, page, router } = await openPage("/en/account/login");

    await user.type(page.getByLabelText(/Email/), "isabel@example.com");
    await user.type(page.getByLabelText(/Password/), "correct horse 42");
    await user.click(page.getByRole("button", { name: "Sign in" }));

    await screen.findByRole("heading", { level: 1, name: /Grown in Sunlight/ });
    expect(router.state.location.pathname).toBe("/en");
  });

  it("create account needs a password of at least 10 characters, with a letter and a number", async () => {
    const { user, page } = await openPage("/en/account/register");

    await user.type(page.getByLabelText(/Full name/), "Isabel");
    await user.type(page.getByLabelText(/Email/), "isabel@example.com");
    await user.type(page.getByLabelText(/Password/), "short");
    await user.click(page.getByRole("button", { name: "Create account" }));

    expect(page.getByLabelText(/Password/)).toHaveAccessibleDescription(/at least 10 characters, with a letter and a number/);
  });

  it("the account type is a radio group, and Business adds a company field", async () => {
    const { user, page } = await openPage("/en/account/register");

    expect(page.getByRole("radio", { name: "Retail account" })).toBeChecked();
    expect(page.queryByLabelText(/Company/)).not.toBeInTheDocument();

    await user.click(page.getByRole("radio", { name: "Business account" }));

    expect(page.getByLabelText(/Company/)).toBeInTheDocument();
    expect(page.getByText(/Business accounts unlock wholesale pricing/)).toBeInTheDocument();
  });
});
