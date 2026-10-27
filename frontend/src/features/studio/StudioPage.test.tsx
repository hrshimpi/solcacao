import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderAt } from "../../test/renderAt";
import { DRAFT_KEY } from "./studioDraft";

async function openStudio() {
  const user = userEvent.setup();
  renderAt("/en/wholesale/studio", { account: "business" });
  await screen.findByRole("heading", { level: 1, name: "The Corporate Cacao Studio" });
  return user;
}

// like openStudio, with a way to close the page again, so a test can open it a second time like a refresh does
async function openStudioAgain(options: Parameters<typeof renderAt>[1] = { account: "business" }, path = "/en/wholesale/studio") {
  const user = userEvent.setup();
  const view = renderAt(path, options);
  await screen.findByRole("heading", { level: 1 });
  return { user, unmount: view.unmount };
}

function savedDraft() {
  const raw = sessionStorage.getItem(DRAFT_KEY);
  return raw === null ? null : JSON.parse(raw);
}

const profileRadio = (name: RegExp) => screen.getByRole("radio", { name });
const next = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Continue" }));
const fileInput = () => document.querySelector<HTMLInputElement>("input[type=file]")!;

// the browser sends this when the tab is about to close or reload, and a page that asks to confirm cancels it
function closeTab() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
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
    renderAt("/en/wholesale/studio", { account: "business" });
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
    expect(screen.getByLabelText(/Estimated units/)).toHaveAccessibleDescription(/usual minimum run is 500 units/);
  });

  it("asks for at least one unit", async () => {
    const user = await openStudio();
    await reachReview(user);

    await user.type(screen.getByLabelText(/Company name/), "Hacienda Brands");
    await user.type(screen.getByLabelText(/Contact name/), "Isabel");
    await user.type(screen.getByLabelText(/Estimated units/), "0");
    await user.click(screen.getByRole("button", { name: "Submit for quote" }));

    expect(screen.getByText("Enter 1 or more.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Estimated units/)).toHaveAttribute("aria-invalid", "true");
  });

  it("warns about fewer than 500 units but still sends the request", async () => {
    const user = await openStudio();
    await reachReview(user);

    await user.type(screen.getByLabelText(/Company name/), "Hacienda Brands");
    await user.type(screen.getByLabelText(/Contact name/), "Isabel");
    await user.type(screen.getByLabelText(/Estimated units/), "100");
    await user.click(screen.getByRole("button", { name: "Submit for quote" }));

    expect(await screen.findByRole("heading", { name: "We have your brief." }, { timeout: 3000 })).toBeInTheDocument();
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

describe("the draft", () => {
  it("writes nothing while nothing has been entered", async () => {
    await openStudio();

    expect(savedDraft()).toBeNull();
  });

  it("is written as soon as something is chosen", async () => {
    const user = await openStudio();

    await user.click(profileRadio(/Ecuador 72%/));

    expect(savedDraft()).toEqual({
      owner: "isabel@example.com",
      draft: { step: 0, profile: "ecu", packaging: null, companyName: "", contactName: "", units: "", notes: "", fileNames: [] },
    });
  });

  it("brings the answers back after a refresh, on the review step where they were", async () => {
    const first = await openStudioAgain();
    await reachReview(first.user);
    await first.user.type(screen.getByLabelText(/Company name/), "Hacienda Brands");
    await first.user.type(screen.getByLabelText(/Contact name/), "Isabel");
    await first.user.type(screen.getByLabelText(/Estimated units/), "800");
    await first.user.type(screen.getByLabelText(/Additional notes/), "Gold foil");
    first.unmount();

    await openStudioAgain();

    expect(screen.getByRole("heading", { name: "Review & submit" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Company name/)).toHaveValue("Hacienda Brands");
    expect(screen.getByLabelText(/Contact name/)).toHaveValue("Isabel");
    expect(screen.getByLabelText(/Estimated units/)).toHaveValue("800");
    expect(screen.getByLabelText(/Additional notes/)).toHaveValue("Gold foil");
    expect(screen.getByText("Cacao profile").nextElementSibling).toHaveTextContent("Ecuador 72%");
    expect(screen.getByText("Packaging").nextElementSibling).toHaveTextContent("Rigid gift box");
  });

  it("brings back the step that was open, with the choices of the steps before it", async () => {
    const first = await openStudioAgain();
    await first.user.click(profileRadio(/Peru 68%/));
    await next(first.user);
    first.unmount();

    const second = await openStudioAgain();

    expect(screen.getByRole("heading", { name: "Select packaging & branding" })).toBeInTheDocument();
    await second.user.click(screen.getByRole("button", { name: "Previous step" }));
    expect(profileRadio(/Peru 68%/)).toBeChecked();
  });

  it("does not keep the files, and says which ones to add again", async () => {
    const first = await openStudioAgain();
    await first.user.click(profileRadio(/Ecuador 72%/));
    await next(first.user);
    await first.user.click(profileRadio(/Rigid gift box/));
    await next(first.user);
    await first.user.upload(fileInput(), new File(["x"], "logo.pdf", { type: "application/pdf" }));
    expect(savedDraft().draft.fileNames).toEqual(["logo.pdf"]);
    first.unmount();

    const second = await openStudioAgain();

    expect(screen.getByText(/These files were not kept when the page was reloaded: logo\.pdf/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove logo.pdf" })).not.toBeInTheDocument();

    await second.user.upload(fileInput(), new File(["x"], "logo.pdf", { type: "application/pdf" }));
    expect(screen.queryByText(/were not kept/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove logo.pdf" })).toBeInTheDocument();
  });

  it("keeps the notice about lost files on the review step too", async () => {
    const first = await openStudioAgain();
    await first.user.click(profileRadio(/Ecuador 72%/));
    await next(first.user);
    await first.user.click(profileRadio(/Rigid gift box/));
    await next(first.user);
    await first.user.upload(fileInput(), new File(["x"], "logo.pdf", { type: "application/pdf" }));
    await next(first.user);
    first.unmount();

    await openStudioAgain();

    expect(screen.getByRole("heading", { name: "Review & submit" })).toBeInTheDocument();
    expect(screen.getByText(/were not kept when the page was reloaded: logo\.pdf/)).toBeInTheDocument();
    expect(screen.getByText("Brand assets").nextElementSibling).toHaveTextContent("None uploaded");
  });

  it("does not write the files themselves into the draft", async () => {
    const user = await openStudio();
    await user.click(profileRadio(/Ecuador 72%/));
    await next(user);
    await user.click(profileRadio(/Rigid gift box/));
    await next(user);

    await user.upload(fileInput(), new File(["secret artwork"], "logo.pdf", { type: "application/pdf" }));

    expect(sessionStorage.getItem(DRAFT_KEY)).not.toContain("secret artwork");
    expect(Object.keys(savedDraft().draft)).not.toContain("files");
  });

  it("is told to screen readers when it was brought back", async () => {
    const first = await openStudioAgain();
    await first.user.click(profileRadio(/Ecuador 72%/));
    first.unmount();

    await openStudioAgain();

    expect(screen.getByRole("status")).toHaveTextContent("Your earlier answers were restored.");
  });

  it("is not announced when there was no draft", async () => {
    await openStudio();

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("is not used when it was written by another account", async () => {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        owner: "someone@else.example",
        draft: { step: 1, profile: "per", packaging: null, companyName: "Other Co", contactName: "", units: "", notes: "", fileNames: [] },
      }),
    );

    await openStudioAgain();

    expect(screen.getByRole("heading", { name: "Choose your cacao profile" })).toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
  });

  it.each([["text that is not JSON", "{broken"], ["a draft that is not a draft", JSON.stringify({ owner: "isabel@example.com", draft: "x" })]])(
    "does not break the page when it holds %s",
    async (_label, saved) => {
      sessionStorage.setItem(DRAFT_KEY, saved);

      await openStudioAgain();

      expect(screen.getByRole("heading", { name: "Choose your cacao profile" })).toBeInTheDocument();
    },
  );

  it("is dropped once the request was sent", async () => {
    const user = await openStudio();
    await reachReview(user);
    await user.type(screen.getByLabelText(/Company name/), "Hacienda Brands");
    await user.type(screen.getByLabelText(/Contact name/), "Isabel");
    await user.type(screen.getByLabelText(/Estimated units/), "800");
    expect(savedDraft()).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Submit for quote" }));
    await screen.findByRole("heading", { name: "We have your brief." }, { timeout: 3000 });

    expect(savedDraft()).toBeNull();
  });

  it("is in Spanish on the Spanish address", async () => {
    const first = await openStudioAgain({ account: "business" }, "/es/wholesale/studio");
    await first.user.click(screen.getByRole("radio", { name: /Ecuador 72%/ }));
    first.unmount();

    await openStudioAgain({ account: "business" }, "/es/wholesale/studio");

    expect(screen.getByRole("status")).toHaveTextContent("Se restauraron sus respuestas anteriores.");
  });
});

describe("the names from the account", () => {
  const names = { name: "Isabel Vasquez", companyName: "Hacienda Brands" };

  it("start the company and the contact on the review step", async () => {
    const { user } = await openStudioAgain({ account: "business", names });
    await reachReview(user);

    expect(screen.getByLabelText(/Company name/)).toHaveValue("Hacienda Brands");
    expect(screen.getByLabelText(/Contact name/)).toHaveValue("Isabel Vasquez");
  });

  it("can be changed", async () => {
    const { user } = await openStudioAgain({ account: "business", names });
    await reachReview(user);

    await user.clear(screen.getByLabelText(/Company name/));
    await user.type(screen.getByLabelText(/Company name/), "Other Co");

    expect(screen.getByLabelText(/Company name/)).toHaveValue("Other Co");
  });

  it("leave the fields empty when the account has no names", async () => {
    const { user } = await openStudioAgain({ account: "business" });
    await reachReview(user);

    expect(screen.getByLabelText(/Company name/)).toHaveValue("");
    expect(screen.getByLabelText(/Contact name/)).toHaveValue("");
  });

  it("are not a draft, and do not make the page ask before it is left", async () => {
    await openStudioAgain({ account: "business", names });

    expect(savedDraft()).toBeNull();
    expect(closeTab()).toBe(false);
  });

  it("give way to what was typed, after a refresh", async () => {
    const first = await openStudioAgain({ account: "business", names });
    await reachReview(first.user);
    await first.user.clear(screen.getByLabelText(/Company name/));
    await first.user.type(screen.getByLabelText(/Company name/), "Other Co");
    first.unmount();

    await openStudioAgain({ account: "business", names });

    expect(screen.getByLabelText(/Company name/)).toHaveValue("Other Co");
    expect(screen.getByLabelText(/Contact name/)).toHaveValue("Isabel Vasquez");
  });
});

describe("leaving the page", () => {
  it("is allowed without a question on a fresh form", async () => {
    await openStudio();

    expect(closeTab()).toBe(false);
  });

  it("makes the browser ask once something was chosen", async () => {
    const user = await openStudio();

    await user.click(profileRadio(/Ecuador 72%/));

    expect(closeTab()).toBe(true);
  });

  it("still asks after a refresh brought the draft back", async () => {
    const first = await openStudioAgain();
    await first.user.click(profileRadio(/Ecuador 72%/));
    first.unmount();

    await openStudioAgain();

    expect(closeTab()).toBe(true);
  });

  it("asks while the request is on its way, and stops asking once it was sent", async () => {
    const user = await openStudio();
    await reachReview(user);
    await user.type(screen.getByLabelText(/Company name/), "Hacienda Brands");
    await user.type(screen.getByLabelText(/Contact name/), "Isabel");
    await user.type(screen.getByLabelText(/Estimated units/), "800");

    await user.click(screen.getByRole("button", { name: "Submit for quote" }));
    expect(closeTab()).toBe(true);

    await screen.findByRole("heading", { name: "We have your brief." }, { timeout: 3000 });
    expect(closeTab()).toBe(false);
  });

  it("stops asking when the page is closed in the app", async () => {
    const { unmount } = await openStudioAgain();
    await userEvent.click(profileRadio(/Ecuador 72%/));
    expect(closeTab()).toBe(true);

    unmount();

    expect(closeTab()).toBe(false);
  });
});

describe("the step header", () => {
  async function reachFiles() {
    const user = await openStudio();
    await user.click(profileRadio(/Ecuador 72%/));
    await next(user);
    await user.click(profileRadio(/Rigid gift box/));
    await next(user);
    return user;
  }

  it("shows the finished steps, the current step and the steps to come", async () => {
    await reachFiles();

    const items = within(screen.getByRole("list", { name: "Progress" })).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(within(items[0]).getByRole("button", { name: /Choose Your Cacao Profile, completed/ })).toBeInTheDocument();
    expect(within(items[1]).getByRole("button", { name: /Select Packaging & Branding, completed/ })).toBeInTheDocument();
    expect(items[2]).toHaveAttribute("aria-current", "step");
    expect(within(items[2]).queryByRole("button")).not.toBeInTheDocument();
    expect(items[3]).not.toHaveAttribute("aria-current");
    expect(within(items[3]).queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not call the current step or the steps to come completed", async () => {
    await reachFiles();

    const items = within(screen.getByRole("list", { name: "Progress" })).getAllByRole("listitem");
    expect(items[2]).not.toHaveTextContent("completed");
    expect(items[3]).not.toHaveTextContent("completed");
  });

  it("says where the person is in one line for a phone", async () => {
    await reachFiles();

    expect(screen.getByText("Step 3 of 4: Brand assets")).toBeInTheDocument();
  });

  it("goes back to a finished step and keeps the choices", async () => {
    const user = await reachFiles();

    await user.click(screen.getByRole("button", { name: /Choose Your Cacao Profile, completed/ }));

    expect(screen.getByRole("heading", { name: "Choose your cacao profile" })).toHaveFocus();
    expect(profileRadio(/Ecuador 72%/)).toBeChecked();
  });

  it("is in Spanish on the Spanish address", async () => {
    const user = userEvent.setup();
    renderAt("/es/wholesale/studio", { account: "business" });
    await screen.findByRole("heading", { level: 1 });
    await user.click(screen.getByRole("radio", { name: /Ecuador 72%/ }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByRole("button", { name: /completado/ })).toBeInTheDocument();
  });
});
