// The sign in and create account pages and what they do with the account type. Coming back to a page after
// signing in is tested together with the studio, in features/wholesale/components/StudioAccessGuard.test.tsx.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt } from "../../test/renderAt";
import { AUTH_STORAGE_KEY } from "./AuthContext";

function saved() {
  return JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY) ?? "null");
}

async function openMain(path: string) {
  const user = userEvent.setup();
  const result = renderAt(path);
  const page = within(await screen.findByRole("main"));
  return { user, page, ...result };
}

describe("sign in", () => {
  it("signs in as a retail account when nothing else is chosen, and goes home", async () => {
    const { user, page, router } = await openMain("/en/account/login");
    expect(page.getByRole("radio", { name: "Retail account" })).toBeChecked();

    await user.type(page.getByLabelText(/Email/), "isabel@example.com");
    await user.type(page.getByLabelText(/Password/), "a long password");
    await user.click(page.getByRole("button", { name: "Sign in" }));

    expect(saved()).toEqual({ email: "isabel@example.com", accountType: "retail" });
    expect(await screen.findByRole("heading", { level: 1, name: /Grown in Sunlight/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en");
  });

  it("signs in as a business account when that is chosen", async () => {
    const { user, page } = await openMain("/en/account/login");

    await user.click(page.getByRole("radio", { name: "Business account" }));
    await user.type(page.getByLabelText(/Email/), "isabel@hacienda.example");
    await user.type(page.getByLabelText(/Password/), "a long password");
    await user.click(page.getByRole("button", { name: "Sign in" }));

    expect(saved()).toEqual({ email: "isabel@hacienda.example", accountType: "business" });
  });

  it("does not sign in with an email that is not an email", async () => {
    const { user, page } = await openMain("/en/account/login");

    await user.type(page.getByLabelText(/Email/), "not-an-email");
    await user.type(page.getByLabelText(/Password/), "a long password");
    await user.click(page.getByRole("button", { name: "Sign in" }));

    expect(saved()).toBeNull();
    expect(page.getByLabelText(/Email/)).toHaveAttribute("aria-invalid", "true");
  });
});

describe("create account", () => {
  it("opens on the retail account", async () => {
    const { page } = await openMain("/en/account/register");

    expect(page.getByRole("radio", { name: "Retail account" })).toBeChecked();
    expect(page.queryByLabelText(/Company/)).not.toBeInTheDocument();
  });

  it("opens on the business account for ?type=business, with the company field", async () => {
    const { page } = await openMain("/en/account/register?type=business");

    expect(page.getByRole("radio", { name: "Business account" })).toBeChecked();
    expect(page.getByLabelText(/Company/)).toBeInTheDocument();
  });

  it.each(["", "?type=retail", "?type=admin", "?type=BUSINESS", "?type=business%20"])(
    "opens on the retail account for %j, so only the exact word picks the business account",
    async (search) => {
      const { page } = await openMain(`/en/account/register${search}`);

      expect(page.getByRole("radio", { name: "Retail account" })).toBeChecked();
    },
  );

  it("can still be switched to the other account type", async () => {
    const { user, page } = await openMain("/en/account/register?type=business");

    await user.click(page.getByRole("radio", { name: "Retail account" }));

    expect(page.getByRole("radio", { name: "Retail account" })).toBeChecked();
    expect(page.queryByLabelText(/Company/)).not.toBeInTheDocument();
  });

  it("signs the new business account in", async () => {
    const { user, page } = await openMain("/en/account/register?type=business");

    await user.type(page.getByLabelText(/Full name/), "Isabel Vasquez");
    await user.type(page.getByLabelText(/Company/), "Hacienda Brands");
    await user.type(page.getByLabelText(/Email/), "isabel@hacienda.example");
    await user.type(page.getByLabelText(/Password/), "a long password");
    await user.click(page.getByRole("button", { name: "Create account" }));

    expect(saved()).toEqual({ email: "isabel@hacienda.example", accountType: "business" });
  });

  it("does not sign anyone in when the form has mistakes", async () => {
    const { user, page } = await openMain("/en/account/register?type=business");

    await user.type(page.getByLabelText(/Full name/), "Isabel Vasquez");
    await user.click(page.getByRole("button", { name: "Create account" }));

    expect(saved()).toBeNull();
    expect(page.getByLabelText(/Company/)).toHaveAttribute("aria-invalid", "true");
  });
});
