import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TOKEN_STORAGE_KEY } from "../../lib/authToken";
import { FakeXhr } from "../../test/fakeXhr";
import { renderAt } from "../../test/renderAt";
import { DRAFT_KEY } from "./studioDraft";

const savedRequestId = "66a1b2c3d4e5f60718293a4b";

// the server saves the request and says so, a moment after it was sent
function serverSaves() {
  FakeXhr.autoAnswer = { status: 201, body: { request: { id: savedRequestId, status: "submitted" } } };
}

// the server does not answer until the test says so, to look at the request while it is on its way
function serverWaits() {
  FakeXhr.autoAnswer = null;
}

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
    serverSaves();
    const user = await openStudio();
    await reachReview(user);

    await user.type(screen.getByLabelText(/Company name/), "Hacienda Brands");
    await user.type(screen.getByLabelText(/Contact name/), "Isabel");
    await user.type(screen.getByLabelText(/Estimated units/), "100");
    await user.click(screen.getByRole("button", { name: "Submit for quote" }));

    expect(await screen.findByRole("heading", { name: "We have your brief." }, { timeout: 3000 })).toBeInTheDocument();
  });

  it("shows the confirmation after a valid submit", async () => {
    serverSaves();
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
    serverSaves();
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
    serverWaits();
    const user = await openStudio();
    await reachReview(user);
    await user.type(screen.getByLabelText(/Company name/), "Hacienda Brands");
    await user.type(screen.getByLabelText(/Contact name/), "Isabel");
    await user.type(screen.getByLabelText(/Estimated units/), "800");

    await user.click(screen.getByRole("button", { name: "Submit for quote" }));
    expect(closeTab()).toBe(true);

    act(() => FakeXhr.last.answer(201, { request: { id: savedRequestId } }));
    await screen.findByRole("heading", { name: "We have your brief." });
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

describe("sending the request", () => {
  const user = () => userEvent.setup();
  let view: ReturnType<typeof renderAt>;

  // opens the studio as a business account, answers the first two steps, and fills in the review step (in either language)
  async function fillEverything(options: { path?: string; files?: File[] } = {}) {
    const person = user();
    const goOn = () => person.click(screen.getByRole("button", { name: /^(Continue|Continuar)$/ }));
    view = renderAt(options.path ?? "/en/wholesale/studio", { account: "business" });
    await screen.findByRole("heading", { level: 1 });
    await person.click(profileRadio(/Ecuador 72%/));
    await goOn();
    await person.click(profileRadio(/Rigid gift box|Caja de regalo rígida/));
    await goOn();
    if (options.files) await person.upload(fileInput(), options.files);
    await goOn();
    await person.type(screen.getByLabelText(/Company name|Nombre de la empresa/), "Hacienda Brands");
    await person.type(screen.getByLabelText(/Contact name|Nombre de contacto/), "Isabel Vasquez");
    await person.type(screen.getByLabelText(/Estimated units|Unidades estimadas/), "800");
    await person.type(screen.getByLabelText(/Additional notes|Notas adicionales/), "Gold foil on the lid");
    return person;
  }

  const submitButton = () => screen.getByRole("button", { name: /Submit for quote|Enviar para cotizar|Sending|Enviando/ });
  const pdf = (name: string) => new File(["%PDF-1.4"], name, { type: "application/pdf" });

  describe("what is sent", () => {
    it("is a multipart form to the quote endpoint, with the field names it expects", async () => {
      serverSaves();
      const person = await fillEverything();

      await person.click(submitButton());
      await screen.findByRole("heading", { name: "We have your brief." });

      expect(FakeXhr.requests).toHaveLength(1);
      const request = FakeXhr.last;
      expect(request.method).toBe("POST");
      expect(request.url).toBe("/api/b2b/quote");
      expect(request.body).toBeInstanceOf(FormData);
      expect(Object.fromEntries((request.body as FormData).entries())).toEqual({
        cacaoProfile: "Ecuador 72%",
        packagingType: "rigid_box",
        quantityEstimate: "800",
        companyName: "Hacienda Brands",
        contactName: "Isabel Vasquez",
        notes: "Gold foil on the lid",
      });
    });

    it("has the brand files in the field brandAssets", async () => {
      serverSaves();
      const person = await fillEverything({ files: [pdf("logo.pdf"), new File(["png"], "mark.png", { type: "image/png" })] });

      await person.click(submitButton());
      await screen.findByRole("heading", { name: "We have your brief." });

      const files = (FakeXhr.last.body as FormData).getAll("brandAssets") as File[];
      expect(files.map((file) => file.name)).toEqual(["logo.pdf", "mark.png"]);
    });

    it("sends the token of the signed in person", async () => {
      serverSaves();
      sessionStorage.setItem(TOKEN_STORAGE_KEY, "abc.def.ghi");
      const person = await fillEverything();

      await person.click(submitButton());
      await screen.findByRole("heading", { name: "We have your brief." });

      expect(FakeXhr.last.headers.Authorization).toBe("Bearer abc.def.ghi");
    });

    it("sends the language of the page, and the same values on the Spanish page", async () => {
      serverSaves();
      const person = await fillEverything({ path: "/es/wholesale/studio" });

      await person.click(submitButton());
      await screen.findByRole("heading", { name: "Recibimos su solicitud." });

      expect(FakeXhr.last.headers["Accept-Language"]).toBe("es");
      expect((FakeXhr.last.body as FormData).get("cacaoProfile")).toBe("Ecuador 72%");
      expect((FakeXhr.last.body as FormData).get("packagingType")).toBe("rigid_box");
    });

    it("is not sent at all while the review step has mistakes", async () => {
      serverSaves();
      const person = user();
      renderAt("/en/wholesale/studio", { account: "business" });
      await screen.findByRole("heading", { level: 1 });
      await reachReview(person);

      await person.click(submitButton());

      expect(FakeXhr.requests).toHaveLength(0);
      expect(screen.getByLabelText(/Company name/)).toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("while it is on its way", () => {
    it("says so, disables the button and the fields, and tells screen readers", async () => {
      serverWaits();
      const person = await fillEverything();

      await person.click(submitButton());

      expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();
      expect(screen.getByLabelText(/Company name/)).toBeDisabled();
      expect(screen.getByLabelText(/Estimated units/)).toBeDisabled();
      expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();
      expect(screen.getByRole("status")).toHaveTextContent("Sending your request.");
    });

    it("sends only one request when the form is submitted twice at once", async () => {
      serverWaits();
      await fillEverything();
      const form = document.querySelector("form")!;

      act(() => {
        fireEvent.submit(form);
        fireEvent.submit(form);
      });

      expect(FakeXhr.requests).toHaveLength(1);
    });

    it("sends only one request when the button is clicked twice", async () => {
      serverWaits();
      const person = await fillEverything();

      await person.dblClick(submitButton());

      expect(FakeXhr.requests).toHaveLength(1);
    });

    it("sends only one request when Enter is pressed in a field after the first send", async () => {
      serverWaits();
      const person = await fillEverything();
      await person.click(submitButton());

      await person.type(screen.getByLabelText(/Estimated units/), "{Enter}");

      expect(FakeXhr.requests).toHaveLength(1);
    });

    it("shows how much of the files has gone up, and then that the server is working", async () => {
      serverWaits();
      const person = await fillEverything({ files: [pdf("logo.pdf")] });
      await person.click(submitButton());
      expect(screen.getByRole("progressbar", { name: "Sending your files: 0%" })).toHaveAttribute("value", "0");

      act(() => FakeXhr.last.progress(250, 1000));
      expect(screen.getByRole("progressbar", { name: "Sending your files: 25%" })).toHaveAttribute("value", "0.25");

      act(() => FakeXhr.last.progress(1000, 1000));
      expect(screen.getByRole("progressbar", { name: "Files sent. Waiting for the server..." })).toHaveAttribute("value", "1");

      act(() => FakeXhr.last.answer(201, { request: { id: savedRequestId } }));
      expect(await screen.findByRole("heading", { name: "We have your brief." })).toBeInTheDocument();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("shows no progress bar when there are no files to send", async () => {
      serverWaits();
      const person = await fillEverything();

      await person.click(submitButton());

      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("says it in Spanish on the Spanish page", async () => {
      serverWaits();
      const person = await fillEverything({ path: "/es/wholesale/studio", files: [pdf("logo.pdf")] });

      await person.click(submitButton());
      act(() => FakeXhr.last.progress(500, 1000));

      expect(screen.getByRole("button", { name: "Enviando..." })).toBeDisabled();
      expect(screen.getByRole("progressbar", { name: "Enviando sus archivos: 50%" })).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Enviando su solicitud.");
    });
  });

  describe("when it was saved", () => {
    it("shows the confirmation with the reference of the request", async () => {
      serverSaves();
      const person = await fillEverything();

      await person.click(submitButton());

      expect(await screen.findByRole("heading", { name: "We have your brief." })).toHaveFocus();
      expect(screen.getByText(/Hacienda Brands \(Ecuador 72%, 800 units\)/)).toBeInTheDocument();
      expect(screen.getByText("Request reference").nextElementSibling).toHaveTextContent("SC-18293A4B");
      expect(screen.getByRole("status")).toHaveTextContent("Your request was received.");
      expect(screen.queryByLabelText(/Company name/)).not.toBeInTheDocument();
    });

    it("no longer says that nothing was really sent", async () => {
      serverSaves();
      const person = await fillEverything();

      await person.click(submitButton());
      await screen.findByRole("heading", { name: "We have your brief." });

      expect(screen.queryByText(/preview/i)).not.toBeInTheDocument();
    });

    it("links to the request that was just saved in My quote requests, and back to the wholesale page", async () => {
      serverSaves();
      const person = await fillEverything();

      await person.click(submitButton());
      await screen.findByRole("heading", { name: "We have your brief." });

      expect(screen.getByRole("link", { name: "My quote requests" })).toHaveAttribute("href", `/en/account/requests?request=${savedRequestId}`);
      expect(screen.getByRole("link", { name: "Back to Wholesale" })).toHaveAttribute("href", "/en/wholesale");
    });

    it("links to the list of the requests when the answer does not say which one was saved", async () => {
      FakeXhr.autoAnswer = { status: 201, body: { something: "else" } };
      const person = await fillEverything();

      await person.click(submitButton());
      await screen.findByRole("heading", { name: "We have your brief." });

      expect(screen.getByRole("link", { name: "My quote requests" })).toHaveAttribute("href", "/en/account/requests");
    });

    it("is in Spanish on the Spanish page", async () => {
      serverSaves();
      const person = await fillEverything({ path: "/es/wholesale/studio" });

      await person.click(submitButton());

      expect(await screen.findByRole("heading", { name: "Recibimos su solicitud." })).toBeInTheDocument();
      expect(screen.getByText("Referencia de la solicitud").nextElementSibling).toHaveTextContent("SC-18293A4B");
      expect(screen.getByRole("link", { name: "Mis solicitudes de cotización" })).toHaveAttribute("href", `/es/account/requests?request=${savedRequestId}`);
      expect(screen.getByRole("link", { name: "Volver a Venta por mayor" })).toHaveAttribute("href", "/es/wholesale");
    });

    it("is still a success when the answer does not say which request was saved, and shows no reference", async () => {
      FakeXhr.autoAnswer = { status: 201, body: { something: "else" } };
      const person = await fillEverything();

      await person.click(submitButton());

      expect(await screen.findByRole("heading", { name: "We have your brief." })).toBeInTheDocument();
      expect(screen.queryByText("Request reference")).not.toBeInTheDocument();
    });

    it("clears the draft", async () => {
      serverWaits();
      const person = await fillEverything();
      await person.click(submitButton());
      expect(savedDraft()).not.toBeNull();

      act(() => FakeXhr.last.answer(201, { request: { id: savedRequestId } }));
      await screen.findByRole("heading", { name: "We have your brief." });

      expect(savedDraft()).toBeNull();
    });

    it("clears the draft even when the page was left before the answer came, so it is not sent twice", async () => {
      serverWaits();
      const person = await fillEverything();
      await person.click(submitButton());
      expect(savedDraft()).not.toBeNull();

      view.unmount();
      await act(async () => FakeXhr.last.answer(201, { request: { id: savedRequestId } }));

      expect(savedDraft()).toBeNull();
    });
  });

  describe("when the server says no", () => {
    it("shows its message, keeps everything that was typed, and lets the person try again", async () => {
      FakeXhr.autoAnswer = { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side.", details: [] } } };
      const person = await fillEverything({ files: [pdf("logo.pdf")] });

      await person.click(submitButton());

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("We could not send your request.");
      expect(alert).toHaveTextContent("Something went wrong on our side.");
      expect(alert).toHaveTextContent("Your answers are still here, so you can try again.");
      expect(alert).toHaveFocus();
      // nothing was lost
      expect(screen.getByRole("heading", { name: "Review & submit" })).toBeInTheDocument();
      expect(screen.getByLabelText(/Company name/)).toHaveValue("Hacienda Brands");
      expect(screen.getByLabelText(/Contact name/)).toHaveValue("Isabel Vasquez");
      expect(screen.getByLabelText(/Estimated units/)).toHaveValue("800");
      expect(screen.getByLabelText(/Additional notes/)).toHaveValue("Gold foil on the lid");
      expect(screen.getByText("Brand assets").nextElementSibling).toHaveTextContent("logo.pdf");
      expect(savedDraft()).not.toBeNull();
      // and the button works again
      expect(screen.getByRole("button", { name: "Submit for quote" })).toBeEnabled();
      expect(screen.getByLabelText(/Company name/)).toBeEnabled();
    });

    it("sends the same request again when the person tries again, and then it works", async () => {
      FakeXhr.autoAnswer = { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side.", details: [] } } };
      const person = await fillEverything({ files: [pdf("logo.pdf")] });
      await person.click(submitButton());
      await screen.findByRole("alert");

      serverSaves();
      await person.click(submitButton());

      expect(await screen.findByRole("heading", { name: "We have your brief." })).toBeInTheDocument();
      expect(FakeXhr.requests).toHaveLength(2);
      expect((FakeXhr.requests[1].body as FormData).getAll("brandAssets")).toHaveLength(1);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("takes the message away while the next try is on its way", async () => {
      FakeXhr.autoAnswer = { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side.", details: [] } } };
      const person = await fillEverything();
      await person.click(submitButton());
      await screen.findByRole("alert");

      serverWaits();
      await person.click(submitButton());

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();
    });

    it.each([
      [400, "VALIDATION_ERROR", "Please enter how many units you need, as a whole number.", "Please enter how many units you need, as a whole number."],
      [401, "UNAUTHENTICATED", "Please sign in to do that.", "The server does not know who you are. Please sign in again, then send the request once more."],
      [403, "FORBIDDEN", "You don't have access to that.", "Only business accounts can send a quote request."],
      [413, "FILE_TOO_LARGE", "That file is too big.", "One of your files is too big. Each file can be up to 50 MB."],
      [429, "RATE_LIMITED", "You have sent a lot of quote requests. Please try again in an hour.", "You have sent a lot of requests. Please try again later."],
      [503, "SERVICE_UNAVAILABLE", "The database is not reachable.", "The database is not reachable."],
    ])("explains a %i answer (%s)", async (status, code, serverMessage, shown) => {
      FakeXhr.autoAnswer = { status, body: { error: { code, message: serverMessage, details: [] } } };
      const person = await fillEverything();

      await person.click(submitButton());

      expect(await screen.findByRole("alert")).toHaveTextContent(shown);
      expect(screen.getByLabelText(/Company name/)).toHaveValue("Hacienda Brands");
    });

    it("explains an answer that is not in the usual shape without showing it", async () => {
      FakeXhr.autoAnswer = { status: 502, body: "<html>Bad gateway</html>" };
      const person = await fillEverything();

      await person.click(submitButton());

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Something went wrong. Please try again.");
      expect(alert).not.toHaveTextContent("Bad gateway");
    });

    it("explains it when the server cannot be reached", async () => {
      serverWaits();
      const person = await fillEverything();
      await person.click(submitButton());

      act(() => FakeXhr.last.failNetwork());

      expect(await screen.findByRole("alert")).toHaveTextContent("We could not reach the server. Check your connection and try again.");
      expect(screen.getByLabelText(/Company name/)).toHaveValue("Hacienda Brands");
    });

    it("says it in Spanish on the Spanish page", async () => {
      FakeXhr.autoAnswer = { status: 429, body: { error: { code: "RATE_LIMITED", message: "You have sent a lot of quote requests.", details: [] } } };
      const person = await fillEverything({ path: "/es/wholesale/studio" });

      await person.click(submitButton());

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("No pudimos enviar su solicitud.");
      expect(alert).toHaveTextContent("Ha enviado muchas solicitudes. Inténtelo de nuevo más tarde.");
      expect(alert).toHaveTextContent("Sus respuestas siguen aquí, así que puede intentarlo de nuevo.");
    });

    it("keeps the browser asking before the tab is closed", async () => {
      FakeXhr.autoAnswer = { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side.", details: [] } } };
      const person = await fillEverything();
      await person.click(submitButton());
      await screen.findByRole("alert");

      expect(closeTab()).toBe(true);
    });
  });
});
