import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "../../app/routes";

function renderProfile() {
  const router = createMemoryRouter(routes, { initialEntries: ["/profile"] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("profile page", () => {
  it("starts read only with the member's details", () => {
    renderProfile();

    expect(screen.getByRole("heading", { name: "Your profile" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("isabel.vasquez@example.com")).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("lets you edit and keeps what you typed after saving", async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    const phone = screen.getByDisplayValue("+1 512 555 0184");
    expect(phone).not.toHaveAttribute("readonly");

    await user.clear(phone);
    await user.type(phone, "+1 512 555 0000");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByDisplayValue("+1 512 555 0000")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Edit profile" })).toBeInTheDocument();
  });

  it("cancel puts the page back in read only mode", async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Edit profile" })).toBeInTheDocument();
  });

  it("shows the password reset panel and confirms the link was sent", async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: /Change password/ }));
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(screen.getByRole("button", { name: "Reset link sent" })).toBeInTheDocument();
  });

  it("switches the notifications toggle", async () => {
    const user = userEvent.setup();
    renderProfile();

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("follows the language switch in the menu", async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getAllByRole("button", { name: "ES" })[0]);

    expect(screen.getByRole("heading", { name: "Tu perfil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar perfil" })).toBeInTheDocument();
  });

  it("log out goes to the sign in page", async () => {
    const user = userEvent.setup();
    const router = renderProfile();

    await user.click(screen.getByRole("button", { name: /Log out/ }));

    expect(router.state.location.pathname).toBe("/login");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("is reachable from the account icon in the menu", async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(routes, { initialEntries: ["/"] });
    render(<RouterProvider router={router} />);

    await user.click(screen.getByRole("link", { name: "View profile" }));

    expect(router.state.location.pathname).toBe("/profile");
    expect(await screen.findByRole("heading", { name: "Your profile" })).toBeInTheDocument();
  });
});
