import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt } from "../../test/renderAt";

async function openStudio() {
  const user = userEvent.setup();
  renderAt("/en/wholesale/studio");
  await screen.findByRole("heading", { level: 1, name: "The Corporate Cacao Studio" });
  return user;
}

async function reachReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: /Ecuador 72%/ }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("radio", { name: /Rigid gift box/ }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

describe("studio wizard", () => {
  it("marks the current step in the progress list", async () => {
    await openStudio();

    const current = document.querySelector('[aria-current="step"]');
    expect(current).toHaveTextContent("Choose Your Cacao Profile");
    expect(screen.getByText("Step 1 of 4: Cacao profile")).toBeInTheDocument();
  });

  it("does not continue without a cacao profile", async () => {
    const user = await openStudio();

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Choose a cacao profile to continue.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Choose your cacao profile" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-invalid", "true");
  });

  it("moves to packaging after a profile is chosen and puts focus on the step heading", async () => {
    const user = await openStudio();

    await user.click(screen.getByRole("radio", { name: /Peru 68%/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const heading = screen.getByRole("heading", { name: "Select packaging & branding" });
    expect(heading).toHaveFocus();
    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent("Select Packaging & Branding");
  });

  it("keeps the choice when you go back", async () => {
    const user = await openStudio();

    await user.click(screen.getByRole("radio", { name: /Peru 68%/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Previous step" }));

    expect(screen.getByRole("radio", { name: /Peru 68%/ })).toBeChecked();
  });

  it("has a Choose file button on the upload step", async () => {
    const user = await openStudio();

    await user.click(screen.getByRole("radio", { name: /Peru 68%/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("radio", { name: /Paper sleeve/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("button", { name: "Choose file" })).toBeInTheDocument();
  });

  it("rejects a file type that is not allowed and accepts a PDF", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderAt("/en/wholesale/studio");
    await screen.findByRole("heading", { level: 1 });

    await user.click(screen.getByRole("radio", { name: /Peru 68%/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("radio", { name: /Paper sleeve/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const input = document.querySelector<HTMLInputElement>("input[type=file]")!;
    await user.upload(input, new File(["x"], "notes.txt", { type: "text/plain" }));
    expect(screen.getAllByText(/notes\.txt is not a supported file/).length).toBeGreaterThan(0);

    await user.upload(input, new File(["x"], "logo.pdf", { type: "application/pdf" }));
    expect(screen.getByText(/logo\.pdf/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove logo.pdf" })).toBeInTheDocument();
  });

  it("checks the contact details on the review step", async () => {
    const user = await openStudio();
    await reachReview(user);

    await user.click(screen.getByRole("button", { name: "Submit for quote" }));

    const company = screen.getByLabelText(/Company name/);
    expect(company).toHaveAttribute("aria-invalid", "true");
    expect(company).toHaveFocus();
    expect(screen.getByLabelText(/Estimated units/)).toHaveAccessibleDescription(/minimum run is 500 units/);
  });

  it("asks for at least 500 units", async () => {
    const user = await openStudio();
    await reachReview(user);

    await user.type(screen.getByLabelText(/Company name/), "Hacienda Brands");
    await user.type(screen.getByLabelText(/Contact name/), "Isabel");
    await user.type(screen.getByLabelText(/Estimated units/), "100");
    await user.click(screen.getByRole("button", { name: "Submit for quote" }));

    expect(screen.getByText("Enter 500 or more.")).toBeInTheDocument();
  });

  it("shows the confirmation after a valid submit", async () => {
    const user = await openStudio();
    await reachReview(user);

    await user.type(screen.getByLabelText(/Company name/), "Hacienda Brands");
    await user.type(screen.getByLabelText(/Contact name/), "Isabel");
    await user.type(screen.getByLabelText(/Estimated units/), "800");
    await user.click(screen.getByRole("button", { name: "Submit for quote" }));

    expect(await screen.findByRole("heading", { name: "We have your brief." }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/Hacienda Brands \(Ecuador 72%, 800 units\)/)).toBeInTheDocument();
  });
});
