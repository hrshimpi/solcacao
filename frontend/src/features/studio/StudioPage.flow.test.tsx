// How the studio behaves when the person goes back and forth between the steps, changes their mind after a failure,
// or the server answers in an unusual way. The basic flow is tested in StudioPage.test.tsx.
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FakeXhr } from "../../test/fakeXhr";
import { renderAt } from "../../test/renderAt";
import { DRAFT_KEY } from "./studioDraft";

const savedRequestId = "66a1b2c3d4e5f60718293a4b";

function serverSaves() {
  FakeXhr.autoAnswer = { status: 201, body: { request: { id: savedRequestId, status: "submitted" } } };
}

function serverFails() {
  FakeXhr.autoAnswer = { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side.", details: [] } } };
}

type User = ReturnType<typeof userEvent.setup>;

async function openStudio() {
  const user = userEvent.setup();
  renderAt("/en/wholesale/studio", { account: "business" });
  await screen.findByRole("heading", { level: 1, name: "The Corporate Cacao Studio" });
  return user;
}

const radio = (name: RegExp) => screen.getByRole("radio", { name });
const next = (user: User) => user.click(screen.getByRole("button", { name: "Continue" }));
const submit = (user: User) => user.click(screen.getByRole("button", { name: "Submit for quote" }));

async function toPackagingStep() {
  const user = await openStudio();
  await user.click(radio(/Ecuador 72%/));
  await next(user);
  return user;
}

async function toReviewStep() {
  const user = await toPackagingStep();
  await user.click(radio(/Rigid gift box/));
  await next(user);
  await next(user);
  return user;
}

async function fillReview(user: User, units = "800") {
  await user.type(screen.getByLabelText(/Company name/), "Hacienda Brands");
  await user.type(screen.getByLabelText(/Contact name/), "Isabel");
  await user.type(screen.getByLabelText(/Estimated units/), units);
}

describe("an error on one step", () => {
  it("is not carried onto the profile step when going back with the button", async () => {
    const user = await toPackagingStep();
    await next(user);
    expect(screen.getByText("Choose a packaging option to continue.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous step" }));

    expect(screen.getByRole("heading", { name: "Choose your cacao profile" })).toBeInTheDocument();
    expect(screen.queryByText("Choose a packaging option to continue.")).not.toBeInTheDocument();
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-invalid");
  });

  it("is not carried onto the profile step when going back with the step list either", async () => {
    const user = await toPackagingStep();
    await next(user);
    expect(screen.getByText("Choose a packaging option to continue.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Choose Your Cacao Profile, completed/ }));

    expect(screen.queryByText("Choose a packaging option to continue.")).not.toBeInTheDocument();
    expect(screen.getByRole("radiogroup")).not.toHaveAttribute("aria-invalid");
  });

  it("is not shown again when the person comes back to the step and has not tried to continue", async () => {
    const user = await toPackagingStep();
    await next(user);
    await user.click(screen.getByRole("button", { name: "Previous step" }));

    await next(user);

    expect(screen.getByRole("heading", { name: "Select packaging & branding" })).toBeInTheDocument();
    expect(screen.queryByText("Choose a packaging option to continue.")).not.toBeInTheDocument();
  });
});

describe("a request that could not be sent", () => {
  it("does not leave its message on the steps before the review", async () => {
    serverFails();
    const user = await toReviewStep();
    await fillReview(user);
    await submit(user);
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Previous step" }));

    expect(screen.getByRole("heading", { name: "Upload your brand assets" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not bring the old message back when the person returns to the review", async () => {
    serverFails();
    const user = await toReviewStep();
    await fillReview(user);
    await submit(user);
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Previous step" }));

    await next(user);

    expect(screen.getByRole("heading", { name: "Review & submit" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends what was changed after the failure, not what was there before", async () => {
    serverFails();
    const user = await toReviewStep();
    await fillReview(user);
    await submit(user);
    await screen.findByRole("alert");

    serverSaves();
    await user.clear(screen.getByLabelText(/Estimated units/));
    await user.type(screen.getByLabelText(/Estimated units/), "1500");
    await submit(user);
    await screen.findByRole("heading", { name: "We have your brief." });

    expect(FakeXhr.requests).toHaveLength(2);
    expect((FakeXhr.requests[0].body as FormData).get("quantityEstimate")).toBe("800");
    expect((FakeXhr.requests[1].body as FormData).get("quantityEstimate")).toBe("1500");
  });

  it("sends the other choice when the person went back after the failure and changed the packaging", async () => {
    serverFails();
    const user = await toReviewStep();
    await fillReview(user);
    await submit(user);
    await screen.findByRole("alert");

    serverSaves();
    await user.click(screen.getByRole("button", { name: /Select Packaging & Branding, completed/ }));
    await user.click(radio(/Paper sleeve/));
    await next(user);
    await next(user);
    await submit(user);
    await screen.findByRole("heading", { name: "We have your brief." });

    expect((FakeXhr.requests[0].body as FormData).get("packagingType")).toBe("rigid_box");
    expect((FakeXhr.requests[1].body as FormData).get("packagingType")).toBe("paper_sleeve");
    // what was typed on the review step was kept while going back and forth
    expect((FakeXhr.requests[1].body as FormData).get("companyName")).toBe("Hacienda Brands");
  });
});

describe("an answer of the server that is not the usual one", () => {
  // A single page site on a host with no backend behind it answers every address with its home page, and a request
  // to /api/b2b/quote then gets a 200. Nothing was saved, so the person must not be told that it was.
  it.each([
    ["a 200 with a page of its own", 200, "<html>home page</html>"],
    ["a 200 with JSON that is not the answer", 200, { status: "ok" }],
    ["a 202 that says nothing about a saved request", 202, { request: { id: "66a1b2c3d4e5f60718293a4b" } }],
  ])("is not a success when it is %s", async (_label, status, body) => {
    FakeXhr.autoAnswer = { status, body };
    const user = await toReviewStep();
    await fillReview(user);

    await submit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("We could not send your request.");
    expect(screen.queryByRole("heading", { name: "We have your brief." })).not.toBeInTheDocument();
    // everything that was typed is still there, so the person can try again
    expect(screen.getByLabelText(/Company name/)).toHaveValue("Hacienda Brands");
    expect(sessionStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });

  it("is a success when it is a 201 that cannot be read, because the request was created, and no second request is invited", async () => {
    // for example a proxy that answers 201 with a page of its own
    FakeXhr.autoAnswer = { status: 201, body: "<html>Created</html>" };
    const user = await toReviewStep();
    await fillReview(user);

    await submit(user);

    expect(await screen.findByRole("heading", { name: "We have your brief." })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Request reference")).not.toBeInTheDocument();
    expect(FakeXhr.requests).toHaveLength(1);
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("is still a failure when it is a 4xx or a 5xx that cannot be read", async () => {
    FakeXhr.autoAnswer = { status: 502, body: "<html>Bad gateway</html>" };
    const user = await toReviewStep();
    await fillReview(user);

    await submit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("We could not send your request.");
    expect(screen.queryByRole("heading", { name: "We have your brief." })).not.toBeInTheDocument();
  });
});

describe("the Enter key", () => {
  it("sends the request from the last field, and shows what is wrong while the form is not ready", async () => {
    serverSaves();
    const user = await toReviewStep();

    await user.type(screen.getByLabelText(/Company name/), "Hacienda Brands{Enter}");
    expect(FakeXhr.requests).toHaveLength(0);
    expect(screen.getByLabelText(/Contact name/)).toHaveAttribute("aria-invalid", "true");

    await user.type(screen.getByLabelText(/Contact name/), "Isabel");
    await user.type(screen.getByLabelText(/Estimated units/), "800{Enter}");

    expect(await screen.findByRole("heading", { name: "We have your brief." })).toBeInTheDocument();
    expect(FakeXhr.requests).toHaveLength(1);
  });

  it("moves on from a step that has a choice, and stays on one that has none", async () => {
    const user = await openStudio();
    await user.click(screen.getByRole("heading", { name: "Choose your cacao profile" }));

    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Choose your cacao profile" })).toBeInTheDocument();

    // Enter with the focus on a radio button that is not chosen is the same as Continue without a choice
    radio(/Ecuador 72%/).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Choose a cacao profile to continue.")).toBeInTheDocument();

    await user.click(radio(/Ecuador 72%/));
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "Select packaging & branding" })).toBeInTheDocument();
  });
});
