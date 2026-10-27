import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("confirms the message when everything is filled in", async () => {
    const { user, page } = await openPage("/en/contact");

    await user.type(page.getByLabelText(/Name/), "Isabel");
    await user.type(page.getByLabelText(/Email/), "isabel@example.com");
    await user.type(page.getByLabelText(/Message/), "Do you ship to Canada?");
    await user.click(page.getByRole("button", { name: "Send message" }));

    expect(await page.findByRole("heading", { name: "Message received." })).toHaveFocus();
  });

  it("has a WhatsApp link that opens in a new tab and says so", async () => {
    const { page } = await openPage("/en/contact");

    const link = page.getByRole("link", { name: /WhatsApp/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAccessibleName(/opens in a new tab/);
  });
});

describe("account forms", () => {
  it("sign in checks the email and the password", async () => {
    const { user, page } = await openPage("/en/account/login");

    await user.click(page.getByRole("button", { name: "Sign in" }));

    expect(page.getByLabelText(/Email/)).toHaveAttribute("aria-invalid", "true");
    expect(page.getByLabelText(/Password/)).toHaveAttribute("aria-invalid", "true");
  });

  it("sign in goes to the home page when the form is valid", async () => {
    const { user, page, router } = await openPage("/en/account/login");

    await user.type(page.getByLabelText(/Email/), "isabel@example.com");
    await user.type(page.getByLabelText(/Password/), "secret123");
    await user.click(page.getByRole("button", { name: "Sign in" }));

    expect(router.state.location.pathname).toBe("/en");
  });

  it("create account needs a password of at least 8 characters", async () => {
    const { user, page } = await openPage("/en/account/register");

    await user.type(page.getByLabelText(/Full name/), "Isabel");
    await user.type(page.getByLabelText(/Email/), "isabel@example.com");
    await user.type(page.getByLabelText(/Password/), "short");
    await user.click(page.getByRole("button", { name: "Create account" }));

    expect(page.getByLabelText(/Password/)).toHaveAccessibleDescription(/at least 8 characters/);
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
