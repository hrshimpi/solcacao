// Smaller behaviours of My quote requests that are about where the focus goes, what happens when the person leaves,
// and the language switch. The main flows (the list, the details, downloads, refreshing) are in MyRequestsPage.test.tsx.
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TOKEN_STORAGE_KEY } from "../../lib/authToken";
import { apiAsset, apiRequest, mockRequestsApi } from "../../test/mockApi";
import { renderAt } from "../../test/renderAt";

const idA = "66a1b2c3d4e5f60718293a4b"; // SC-18293A4B
const idB = "66a1b2c3d4e5f60718293a4c"; // SC-18293A4C

async function open(path: string) {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, "abc.def.ghi");
  const user = userEvent.setup();
  const view = renderAt(path, { account: "business" });
  return { user, ...view };
}

describe("where the focus goes", () => {
  it("does not move to the details when the list is read again, after the open request was clicked again", async () => {
    mockRequestsApi([apiRequest(idA), apiRequest(idB, { cacaoProfile: "Peru 68%" })]);
    const { user } = await open(`/en/account/requests?request=${idA}`);
    const heading = await screen.findByRole("heading", { name: "Request SC-18293A4B" });

    // clicking the request that is already open changes nothing on the page
    await user.click(screen.getByRole("link", { name: /Ecuador 72%/ }));
    // and later the list is read again, which gives the page new objects for the same requests
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled());

    expect(heading).not.toHaveFocus();
  });

  it("does not move to the details when the list is read again in the background", async () => {
    mockRequestsApi([apiRequest(idA)]);
    const { user } = await open("/en/account/requests");
    await user.click(await screen.findByRole("link", { name: /Ecuador 72%/ }));
    const heading = await screen.findByRole("heading", { name: "Request SC-18293A4B" });
    expect(heading).toHaveFocus();

    // the person moves on to the Refresh button, then the list changes under them
    screen.getByRole("link", { name: "New request" }).focus();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled());

    expect(heading).not.toHaveFocus();
  });

  it("moves to the details every time another request is chosen", async () => {
    mockRequestsApi([apiRequest(idA), apiRequest(idB, { cacaoProfile: "Peru 68%" })]);
    const { user } = await open("/en/account/requests");

    await user.click(await screen.findByRole("link", { name: /Ecuador 72%/ }));
    expect(await screen.findByRole("heading", { name: "Request SC-18293A4B" })).toHaveFocus();

    await user.click(screen.getByRole("link", { name: /Peru 68%/ }));
    expect(await screen.findByRole("heading", { name: "Request SC-18293A4C" })).toHaveFocus();

    await user.click(screen.getByRole("link", { name: /Ecuador 72%/ }));
    expect(await screen.findByRole("heading", { name: "Request SC-18293A4B" })).toHaveFocus();
  });
});

describe("leaving the page", () => {
  it("cancels a download that is still on its way", async () => {
    const server = mockRequestsApi([apiRequest(idA, { brandAssets: [apiAsset("one.pdf", "guide.pdf")] })]);
    server.file = () => new Promise<Response>(() => {});
    const { user, unmount } = await open(`/en/account/requests?request=${idA}`);
    await user.click(await screen.findByRole("button", { name: "Download guide.pdf" }));
    const call = server.fetchMock.mock.calls.find(([url]) => String(url).includes("/assets/"))!;
    const signal = (call[1] as RequestInit).signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it("cancels the reading of the list", async () => {
    const server = mockRequestsApi([apiRequest(idA)]);
    server.list = () => new Promise<Response>(() => {});
    const { unmount } = await open("/en/account/requests");
    await screen.findByText("Loading your quote requests...");
    const call = server.fetchMock.mock.calls.find(([url]) => String(url).startsWith("/api/b2b/requests?"))!;
    const signal = (call[1] as RequestInit).signal as AbortSignal;

    unmount();

    expect(signal.aborted).toBe(true);
  });
});

describe("the language switch", () => {
  it("keeps the open request when the language is changed, and shows it in the other language", async () => {
    mockRequestsApi([apiRequest(idA, { status: "quoted", quoteAmount: 125000 })]);
    const { user, router } = await open(`/en/account/requests?request=${idA}`);
    const details = await screen.findByRole("region", { name: "Request SC-18293A4B" });
    expect(within(details).getByText("Quoted")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^ES$|Español|Spanish/ }));

    expect(router.state.location.pathname).toBe("/es/account/requests");
    expect(router.state.location.search).toBe(`?request=${idA}`);
    expect(await screen.findByRole("region", { name: "Solicitud SC-18293A4B" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Solicitud SC-18293A4B" })).getByText("Cotizada")).toBeInTheDocument();
  });
});

describe("a request in the list that is not like the others", () => {
  it("shows a request that has a quote of zero cents as a quote", async () => {
    mockRequestsApi([apiRequest(idA, { status: "quoted", quoteAmount: 0 })]);
    await open("/en/account/requests");

    expect(await screen.findByRole("link", { name: /Ecuador 72%/ })).toHaveTextContent("$0.00");
  });

  it("keeps a very long company name, note and file name inside the page", async () => {
    const long = "word".repeat(80);
    mockRequestsApi([apiRequest(idA, { companyName: long, notes: long, brandAssets: [apiAsset("one.pdf", `${long}.pdf`)] })]);
    await open(`/en/account/requests?request=${idA}`);

    const details = await screen.findByRole("region", { name: "Request SC-18293A4B" });
    expect(details).toHaveTextContent(long);
    // the words are allowed to break (the layout test in the browser checks that nothing is wider than the screen)
    const holders = [...details.querySelectorAll("dd"), ...details.querySelectorAll("li > div > span")].filter((element) => (element.textContent ?? "").includes(long));
    expect(holders.length).toBeGreaterThanOrEqual(3);
    for (const holder of holders) expect(holder.className, holder.tagName).toMatch(/break-(words|all)/);
  });
});
