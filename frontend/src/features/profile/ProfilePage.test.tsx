import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt } from "../../test/renderAt";

describe("profile page", () => {
  it("starts read only with the member details", async () => {
    renderAt("/en/profile");

    expect(await screen.findByRole("heading", { level: 1, name: "Your profile" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("isabel.vasquez@example.com")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("lets you edit and keeps what you typed after saving", async () => {
    const user = userEvent.setup();
    renderAt("/en/profile");

    await user.click(await screen.findByRole("button", { name: "Edit profile" }));
    const phone = screen.getByLabelText("Phone");
    expect(phone).not.toHaveAttribute("readonly");

    await user.clear(phone);
    await user.type(phone, "+1 512 555 0000");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByDisplayValue("+1 512 555 0000")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Edit profile" })).toHaveFocus();
    expect(within(screen.getByRole("main")).getByText(/Changes saved/)).toBeInTheDocument();
  });

  it("shows an error and does not save when a field is not valid", async () => {
    const user = userEvent.setup();
    renderAt("/en/profile");

    await user.click(await screen.findByRole("button", { name: "Edit profile" }));
    const name = screen.getByLabelText(/Full name/);
    await user.clear(name);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("This field is required.");
    expect(name).toHaveFocus();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("cancel puts the old values back and returns to read only mode", async () => {
    const user = userEvent.setup();
    renderAt("/en/profile");

    await user.click(await screen.findByRole("button", { name: "Edit profile" }));
    await user.type(screen.getByLabelText("Location"), " Texas");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Edit profile" })).toBeInTheDocument();
    expect(screen.getByLabelText("Location")).toHaveValue("Austin, Texas");
  });

  it("opens the password panel and confirms the link was sent", async () => {
    const user = userEvent.setup();
    renderAt("/en/profile");

    const toggle = await screen.findByRole("button", { name: /Change password/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(screen.getByRole("button", { name: "Reset link sent" })).toBeInTheDocument();
  });

  it("switches the notifications toggle", async () => {
    const user = userEvent.setup();
    renderAt("/en/profile");

    const toggle = await screen.findByRole("switch", { name: "Notification preferences" });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("follows the language switch", async () => {
    const user = userEvent.setup();
    const { router } = renderAt("/en/profile");

    await user.click(await screen.findByRole("button", { name: "ES, Español" }));

    expect(router.state.location.pathname).toBe("/es/profile");
    expect(await screen.findByRole("heading", { level: 1, name: "Tu perfil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar perfil" })).toBeInTheDocument();
  });

  it("log out goes to the sign in page", async () => {
    const user = userEvent.setup();
    const { router } = renderAt("/en/profile");

    await user.click(await screen.findByRole("link", { name: /Log out/ }));

    expect(router.state.location.pathname).toBe("/en/account/login");
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
  });

  describe("the link to the quote requests", () => {
    it("is there for a business account, and leads to the page", async () => {
      const user = userEvent.setup();
      const { router } = renderAt("/en/profile", { account: "business" });

      const section = within(await screen.findByRole("region", { name: "Wholesale" }));
      const link = section.getByRole("link", { name: /My quote requests/ });
      expect(link).toHaveAttribute("href", "/en/account/requests");
      expect(link).toHaveAccessibleName(/Follow the quotes you asked for in the Studio/);

      await user.click(link);
      expect(router.state.location.pathname).toBe("/en/account/requests");
    });

    it("is not there for a retail account", async () => {
      renderAt("/en/profile", { account: "retail" });
      await screen.findByRole("heading", { level: 1, name: "Your profile" });

      expect(screen.queryByRole("region", { name: "Wholesale" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /My quote requests/ })).not.toBeInTheDocument();
    });

    it("is not there for somebody who is not signed in", async () => {
      renderAt("/en/profile");
      await screen.findByRole("heading", { level: 1, name: "Your profile" });

      expect(screen.queryByRole("link", { name: /My quote requests/ })).not.toBeInTheDocument();
    });

    it("is in Spanish on the Spanish address", async () => {
      renderAt("/es/profile", { account: "business" });

      const section = within(await screen.findByRole("region", { name: "Venta por mayor" }));
      expect(section.getByRole("link", { name: /Mis solicitudes de cotización/ })).toHaveAttribute("href", "/es/account/requests");
    });
  });

  it("is reachable from the account icon", async () => {
    const user = userEvent.setup();
    const { router } = renderAt("/en");

    await user.click(await screen.findByRole("link", { name: "View profile" }));

    expect(router.state.location.pathname).toBe("/en/profile");
    expect(await screen.findByRole("heading", { level: 1, name: "Your profile" })).toBeInTheDocument();
  });
});
