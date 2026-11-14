import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formatDate } from "../../i18n/format";
import { TOKEN_STORAGE_KEY } from "../../lib/authToken";
import { apiAsset, apiRequest, errorResponse, jsonResponse, mockRequestsApi } from "../../test/mockApi";
import { renderAt } from "../../test/renderAt";

const idA = "66a1b2c3d4e5f60718293a4b"; // SC-18293A4B
const idB = "66a1b2c3d4e5f60718293a4c"; // SC-18293A4C
const idC = "66a1b2c3d4e5f60718293a4d"; // SC-18293A4D
const idD = "66a1b2c3d4e5f60718293a4e"; // SC-18293A4E
const token = "abc.def.ghi";

// opens the page as a business account that has a token, which is what the real sign in will give
async function open(path = "/en/account/requests", account: "business" | "retail" | null = "business") {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  const user = userEvent.setup();
  const view = renderAt(path, account ? { account } : {});
  return { user, ...view };
}

const list = () => within(screen.getByRole("region", { name: /Your quote requests|Sus solicitudes de cotización/ }));

describe("who can open the page", () => {
  it("sends a guest to the sign in page, which brings them back", async () => {
    mockRequestsApi();
    const { router } = await open("/en/account/requests", null);

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/en/account/login");
    expect(router.state.location.search).toBe("?next=%2Faccount%2Frequests");
  });

  it("tells a retail account that the page is for business accounts, and does not ask the server for anything", async () => {
    const server = mockRequestsApi([apiRequest(idA)]);
    await open("/en/account/requests", "retail");

    expect(await screen.findByRole("heading", { level: 1, name: "Quote requests are for business accounts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a business account" })).toHaveAttribute("href", "/en/account/register?type=business");
    expect(screen.getByRole("link", { name: "Back to Wholesale" })).toHaveAttribute("href", "/en/wholesale");
    expect(server.calls).toHaveLength(0);
  });

  it("opens for a business account", async () => {
    mockRequestsApi();
    await open();

    expect(await screen.findByRole("heading", { level: 1, name: "My quote requests" })).toBeInTheDocument();
  });

  it("has its own title", async () => {
    mockRequestsApi();
    await open();
    await screen.findByRole("heading", { level: 1, name: "My quote requests" });

    expect(document.title).toContain("My quote requests");
  });

  it("says the same in Spanish", async () => {
    mockRequestsApi();
    await open("/es/account/requests", "retail");

    expect(await screen.findByRole("heading", { level: 1, name: "Las solicitudes de cotización son para cuentas de empresa" })).toBeInTheDocument();
  });
});

describe("asking the server", () => {
  it("reads the requests with the token in the Authorization header", async () => {
    const server = mockRequestsApi([apiRequest(idA)]);
    await open();
    await screen.findByRole("link", { name: /Ecuador 72%/ });

    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].url).toBe("/api/b2b/requests?limit=100");
    expect(server.calls[0].headers.Authorization).toBe(`Bearer ${token}`);
    expect(server.calls[0].headers["Accept-Language"]).toBe("en");
  });
});

describe("loading", () => {
  it("says that the requests are loading, and the page shows no list yet", async () => {
    const server = mockRequestsApi();
    let answer: (response: Response) => void = () => {};
    server.list = () => new Promise<Response>((resolve) => (answer = resolve));
    await open();

    await screen.findByRole("heading", { level: 1, name: "My quote requests" });
    expect(screen.getByText("Loading your quote requests...")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your quote requests" })).not.toBeInTheDocument();

    await act(async () => answer(jsonResponse({ items: [apiRequest(idA)], total: 1 })));
    expect(await screen.findByRole("link", { name: /Ecuador 72%/ })).toBeInTheDocument();
    expect(screen.queryByText("Loading your quote requests...")).not.toBeInTheDocument();
  });
});

describe("the list", () => {
  const items = [
    apiRequest(idA, { status: "submitted", createdAt: "2026-10-26T12:00:00.000Z" }),
    apiRequest(idB, { status: "quoted", quoteAmount: 125000, cacaoProfile: "Peru 68%", packagingType: "foil_wrap", quantityEstimate: 1200, createdAt: "2026-10-20T12:00:00.000Z" }),
    apiRequest(idC, { status: "approved", quoteAmount: 99900, cacaoProfile: "Custom blend", packagingType: "specimen_card", quantityEstimate: 500, createdAt: "2026-10-12T12:00:00.000Z" }),
    apiRequest(idD, { status: "rejected", cacaoProfile: "Madagascar 80%", packagingType: "paper_sleeve", quantityEstimate: 1, createdAt: "2026-10-01T12:00:00.000Z" }),
  ];

  it("has a row for each request, in the order the server sent them", async () => {
    mockRequestsApi(items);
    await open();
    await screen.findByRole("link", { name: /Ecuador 72%/ });

    const rows = list().getAllByRole("link");
    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Ecuador 72%"),
      expect.stringContaining("Peru 68%"),
      expect.stringContaining("Custom blend"),
      expect.stringContaining("Madagascar 80%"),
    ]);
  });

  it("shows the date, the cacao profile, the packaging and the units of each request", async () => {
    mockRequestsApi(items);
    await open();

    const first = (await screen.findByRole("link", { name: /Ecuador 72%/ })).textContent;
    expect(first).toContain("Oct 26, 2026");
    expect(first).toContain("Ecuador 72%");
    expect(first).toContain("Rigid gift box");
    expect(first).toContain("800 units");

    const second = screen.getByRole("link", { name: /Peru 68%/ }).textContent;
    expect(second).toContain("Premium foil wrap");
    expect(second).toContain("1,200 units");
  });

  it("shows the status of each request as a word", async () => {
    mockRequestsApi(items);
    await open();
    await screen.findByRole("link", { name: /Ecuador 72%/ });

    expect(within(screen.getByRole("link", { name: /Ecuador 72%/ })).getByText("Submitted")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /Peru 68%/ })).getByText("Quoted")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /Custom blend/ })).getByText("Approved")).toBeInTheDocument();
    expect(within(screen.getByRole("link", { name: /Madagascar 80%/ })).getByText("Rejected")).toBeInTheDocument();
  });

  it("shows the amount of a quote, and nothing for a request that has none", async () => {
    mockRequestsApi(items);
    await open();
    await screen.findByRole("link", { name: /Ecuador 72%/ });

    expect(screen.getByRole("link", { name: /Peru 68%/ })).toHaveTextContent("$1,250.00");
    expect(screen.getByRole("link", { name: /Custom blend/ })).toHaveTextContent("$999.00");
    expect(screen.getByRole("link", { name: /Ecuador 72%/ })).not.toHaveTextContent("$");
    expect(screen.getByRole("link", { name: /Madagascar 80%/ })).not.toHaveTextContent("$");
  });

  it("says one unit in the singular", async () => {
    mockRequestsApi(items);
    await open();

    expect(await screen.findByRole("link", { name: /Madagascar 80%/ })).toHaveTextContent("1 unit");
    expect(screen.getByRole("link", { name: /Madagascar 80%/ })).not.toHaveTextContent("1 units");
  });

  it("shows a profile or a packaging it does not know as it was stored", async () => {
    mockRequestsApi([apiRequest(idA, { cacaoProfile: "Ghana 70%", packagingType: "gold_bar" })]);
    await open();

    const row = await screen.findByRole("link", { name: /Ghana 70%/ });
    expect(row).toHaveTextContent("gold_bar");
  });

  it("shows a status it does not know as the server sent it", async () => {
    mockRequestsApi([apiRequest(idA, { status: "on_hold" })]);
    await open();

    expect(await screen.findByRole("link", { name: /on_hold/ })).toBeInTheDocument();
  });

  it("says when there are more requests than the ones shown", async () => {
    const server = mockRequestsApi(items);
    server.total = 130;
    await open();

    expect(await screen.findByText("Showing your latest 4 of 130 requests.")).toBeInTheDocument();
  });

  it("does not say it when everything is shown", async () => {
    mockRequestsApi(items);
    await open();
    await screen.findByRole("link", { name: /Ecuador 72%/ });

    expect(screen.queryByText(/Showing your latest/)).not.toBeInTheDocument();
  });

  it("has a way to start a new request", async () => {
    mockRequestsApi(items);
    await open();

    expect(await screen.findByRole("link", { name: "New request" })).toHaveAttribute("href", "/en/wholesale/studio");
  });

  it("leaves out an item without an id, and a field of the wrong kind does not break the page", async () => {
    mockRequestsApi([{ nonsense: true }, apiRequest(idA, { quantityEstimate: "lots", brandAssets: "none", quoteAmount: "free" })]);
    await open();

    const rows = (await screen.findAllByRole("link", { name: /Ecuador 72%/ })).filter((link) => link.getAttribute("href")?.includes("request="));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("0 units");
    expect(rows[0]).not.toHaveTextContent("$");
  });
});

describe("when there are no requests", () => {
  it("says so, and has a button to the studio", async () => {
    mockRequestsApi([]);
    await open();

    expect(await screen.findByRole("heading", { name: "You have not sent a quote request yet." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start in the Studio" })).toHaveAttribute("href", "/en/wholesale/studio");
    expect(screen.queryByRole("region", { name: "Your quote requests" })).not.toBeInTheDocument();
  });

  it("says it in Spanish", async () => {
    mockRequestsApi([]);
    await open("/es/account/requests");

    expect(await screen.findByRole("heading", { name: "Todavía no ha enviado ninguna solicitud de cotización." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Empezar en el Estudio" })).toHaveAttribute("href", "/es/wholesale/studio");
  });
});

describe("when the requests cannot be loaded", () => {
  it.each([
    [401, "UNAUTHENTICATED", "The server does not know who you are. Please sign in again."],
    [403, "FORBIDDEN", "Only business accounts have quote requests."],
    [500, "INTERNAL_ERROR", "Something went wrong. Please try again."],
  ])("explains a %i answer, in the words of the page", async (status, code, shown) => {
    const server = mockRequestsApi();
    server.list = () => errorResponse(status, code, "A message of the server, in English.");
    await open();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We could not load your quote requests.");
    expect(alert).toHaveTextContent(shown);
    expect(alert).not.toHaveTextContent("A message of the server");
  });

  it("explains it when the server cannot be reached", async () => {
    const server = mockRequestsApi();
    server.list = () => Promise.reject(new TypeError("Failed to fetch"));
    await open();

    expect(await screen.findByRole("alert")).toHaveTextContent("We could not reach the server. Check your connection and try again.");
  });

  it("explains an answer that is not a list", async () => {
    const server = mockRequestsApi();
    server.list = () => jsonResponse({ requests: "nope" });
    await open();

    expect(await screen.findByRole("alert")).toHaveTextContent("We could not load your quote requests.");
  });

  it("lets the person try again, and then shows the requests", async () => {
    const server = mockRequestsApi([apiRequest(idA)]);
    server.list = () => errorResponse(500, "INTERNAL_ERROR", "Something went wrong on our side.");
    const { user } = await open();
    await screen.findByRole("alert");

    server.list = undefined;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: /Ecuador 72%/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says it in Spanish", async () => {
    const server = mockRequestsApi();
    server.list = () => errorResponse(500, "INTERNAL_ERROR", "Something went wrong on our side.");
    await open("/es/account/requests");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos cargar sus solicitudes de cotización.");
    expect(screen.getByRole("button", { name: "Intentar de nuevo" })).toBeInTheDocument();
  });
});

describe("the details of a request", () => {
  const withEverything = apiRequest(idB, {
    status: "quoted",
    quoteAmount: 125000,
    quoteNote: "Includes shipping.\nValid for 30 days.",
    notes: "Gold foil on the lid",
    cacaoProfile: "Peru 68%",
    packagingType: "foil_wrap",
    quantityEstimate: 1200,
    brandAssets: [apiAsset("one.pdf", "brand guide.pdf", { sizeBytes: 3 * 1024 * 1024 }), apiAsset("two.png", "logo.png", { mimeType: "image/png", sizeBytes: 2048 })],
  });

  it("asks the person to choose a request, when none is chosen", async () => {
    mockRequestsApi([apiRequest(idA)]);
    await open();

    expect(await screen.findByText("Choose a request from the list to see its details.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^Request SC-/ })).not.toBeInTheDocument();
  });

  it("opens when a request is clicked, with its own address, and puts focus on its heading", async () => {
    mockRequestsApi([apiRequest(idA), withEverything]);
    const { user, router } = await open();

    await user.click(await screen.findByRole("link", { name: /Peru 68%/ }));

    const heading = await screen.findByRole("heading", { name: "Request SC-18293A4C" });
    expect(heading).toHaveFocus();
    expect(router.state.location.pathname).toBe("/en/account/requests");
    expect(router.state.location.search).toBe(`?request=${idB}`);
    expect(screen.getByRole("link", { name: /Peru 68%/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: /Ecuador 72%/ })).not.toHaveAttribute("aria-current");
  });

  it("shows everything about the request", async () => {
    mockRequestsApi([withEverything]);
    const { user } = await open();
    await user.click(await screen.findByRole("link", { name: /Peru 68%/ }));

    const details = within(await screen.findByRole("region", { name: "Request SC-18293A4C" }));
    const row = (label: string) => details.getByText(label).nextElementSibling;
    expect(row("Sent on")).toHaveTextContent("Oct 26, 2026");
    expect(row("Cacao profile")).toHaveTextContent("Peru 68%");
    expect(row("Packaging")).toHaveTextContent("Premium foil wrap");
    expect(row("Estimated units")).toHaveTextContent("1,200 units");
    expect(row("Company name")).toHaveTextContent("Hacienda Brands");
    expect(row("Contact name")).toHaveTextContent("Isabel Vasquez");
    expect(row("Quote")).toHaveTextContent("$1,250.00");
    expect(row("Note from our team")).toHaveTextContent("Includes shipping.");
    expect(row("Note from our team")).toHaveTextContent("Valid for 30 days.");
    expect(row("Additional notes")).toHaveTextContent("Gold foil on the lid");
    expect(details.getByText("Quoted")).toBeInTheDocument();
    expect(details.getByText("Your quote is ready. Check the amount and the note below.")).toBeInTheDocument();
  });

  it("lists the files that were sent, with their sizes", async () => {
    mockRequestsApi([withEverything]);
    const { user } = await open();
    await user.click(await screen.findByRole("link", { name: /Peru 68%/ }));

    expect(await screen.findByText(/brand guide\.pdf/)).toHaveTextContent("(3.0 MB)");
    expect(screen.getByText(/logo\.png/)).toHaveTextContent("(2 KB)");
    expect(screen.getByRole("button", { name: "Download brand guide.pdf" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download logo.png" })).toBeInTheDocument();
  });

  it("says when no files were sent, and leaves out the quote and the notes that are not there", async () => {
    mockRequestsApi([apiRequest(idA)]);
    const { user } = await open();
    await user.click(await screen.findByRole("link", { name: /Ecuador 72%/ }));

    const details = within(await screen.findByRole("region", { name: "Request SC-18293A4B" }));
    expect(details.getByText("No files were sent with this request.")).toBeInTheDocument();
    expect(details.queryByText("Quote")).not.toBeInTheDocument();
    expect(details.queryByText("Note from our team")).not.toBeInTheDocument();
    expect(details.queryByText("Additional notes")).not.toBeInTheDocument();
    expect(details.getByText("We have it. A quote usually comes within two business days.")).toBeInTheDocument();
  });

  it.each([
    ["approved", "This quote was approved."],
    ["rejected", "This request was declined."],
  ])("says what a %s request means", async (status, help) => {
    mockRequestsApi([apiRequest(idA, { status, quoteAmount: 5000 })]);
    const { user } = await open();
    await user.click(await screen.findByRole("link", { name: /Ecuador 72%/ }));

    expect(await screen.findByText(help)).toBeInTheDocument();
  });

  it("is open straight away for an address that names the request, without taking the focus", async () => {
    mockRequestsApi([apiRequest(idA), withEverything]);
    await open(`/en/account/requests?request=${idB}`);

    expect(await screen.findByRole("heading", { name: "Request SC-18293A4C" })).not.toHaveFocus();
    expect(screen.getByRole("link", { name: /Peru 68%/ })).toHaveAttribute("aria-current", "true");
  });

  it("says so when the address names a request that is not in the list", async () => {
    mockRequestsApi([apiRequest(idA)]);
    await open(`/en/account/requests?request=${idD}`);

    expect(await screen.findByText("That request is not in your list.")).toBeInTheDocument();
  });

  it("moves to another request when it is clicked", async () => {
    mockRequestsApi([apiRequest(idA), withEverything]);
    const { user } = await open();
    await user.click(await screen.findByRole("link", { name: /Peru 68%/ }));
    await screen.findByRole("heading", { name: "Request SC-18293A4C" });

    await user.click(screen.getByRole("link", { name: /Ecuador 72%/ }));

    expect(await screen.findByRole("heading", { name: "Request SC-18293A4B" })).toHaveFocus();
    expect(screen.queryByRole("heading", { name: "Request SC-18293A4C" })).not.toBeInTheDocument();
  });

  it("is in Spanish on the Spanish address", async () => {
    mockRequestsApi([withEverything]);
    const { user } = await open("/es/account/requests");
    await user.click(await screen.findByRole("link", { name: /Perú 68%/ }));

    const details = within(await screen.findByRole("region", { name: "Solicitud SC-18293A4C" }));
    expect(details.getByText("Cotizada")).toBeInTheDocument();
    expect(details.getByText("Enviada el").nextElementSibling).toHaveTextContent(formatDate(withEverything.createdAt, "es"));
    expect(details.getByText("Empaque").nextElementSibling).toHaveTextContent("Envoltura de foil premium");
    expect(details.getByText("Nota de nuestro equipo")).toBeInTheDocument();
    expect(details.getByRole("button", { name: "Descargar logo.png" })).toBeInTheDocument();
  });

  it("shows a custom blend with its Spanish name on the Spanish address", async () => {
    mockRequestsApi([apiRequest(idA, { cacaoProfile: "Custom blend" })]);
    await open("/es/account/requests");

    expect(await screen.findByRole("link", { name: /Mezcla personalizada/ })).toBeInTheDocument();
  });
});

describe("downloading a file", () => {
  let saved: { download: string; href: string }[];
  let blobs: Blob[];
  const withFiles = apiRequest(idB, {
    brandAssets: [apiAsset("one.pdf", "brand guide.pdf"), apiAsset("weird name#1.png", "logo.png", { mimeType: "image/png" })],
  });

  beforeEach(() => {
    saved = [];
    blobs = [];
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      blobs.push(blob as Blob);
      return "blob:http://localhost/file";
    });
    URL.revokeObjectURL = vi.fn();
    // jsdom does not navigate, so the click on the link that saves the file is only written down
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ download: this.download, href: this.href });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function openFiles() {
    const server = mockRequestsApi([withFiles]);
    const { user } = await open(`/en/account/requests?request=${idB}`);
    await screen.findByRole("heading", { name: "Request SC-18293A4C" });
    return { server, user };
  }

  it("asks the server for the file with the token in the Authorization header", async () => {
    const { server, user } = await openFiles();

    await user.click(screen.getByRole("button", { name: "Download brand guide.pdf" }));
    await screen.findByRole("button", { name: "Download brand guide.pdf" });

    const call = server.calls.find((entry) => entry.url.includes("/assets/"));
    expect(call?.url).toBe(`/api/b2b/requests/${idB}/assets/one.pdf`);
    expect(call?.headers.Authorization).toBe(`Bearer ${token}`);
  });

  it("saves what came back under the name the file was uploaded with", async () => {
    const { server, user } = await openFiles();
    server.fileContent = "the bytes of the file";

    await user.click(screen.getByRole("button", { name: "Download brand guide.pdf" }));

    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].download).toBe("brand guide.pdf");
    expect(saved[0].href).toBe("blob:http://localhost/file");
    expect(await blobs[0].text()).toBe("the bytes of the file");
  });

  it("encodes a stored name that needs it", async () => {
    const { server, user } = await openFiles();

    await user.click(screen.getByRole("button", { name: "Download logo.png" }));
    await vi.waitFor(() => expect(saved).toHaveLength(1));

    expect(server.calls.find((entry) => entry.url.includes("/assets/weird"))?.url).toBe(`/api/b2b/requests/${idB}/assets/weird%20name%231.png`);
    expect(saved[0].download).toBe("logo.png");
  });

  it("tells screen readers that the file was saved", async () => {
    const { user } = await openFiles();

    await user.click(screen.getByRole("button", { name: "Download brand guide.pdf" }));

    await vi.waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("brand guide.pdf was saved."));
  });

  it("disables the button while the file is on its way, so it is not fetched twice", async () => {
    const { server, user } = await openFiles();
    let answer: (response: Response) => void = () => {};
    server.file = () => new Promise<Response>((resolve) => (answer = resolve));

    await user.click(screen.getByRole("button", { name: "Download brand guide.pdf" }));
    const button = screen.getByRole("button", { name: "Download brand guide.pdf" });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Downloading...");
    await user.click(button);
    expect(server.calls.filter((entry) => entry.url.includes("/assets/"))).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Download logo.png" })).toBeEnabled();

    await act(async () => answer(new Response("x", { status: 200 })));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Download brand guide.pdf" })).toBeEnabled());
  });

  it.each([
    [401, "UNAUTHENTICATED", "The server does not know who you are. Please sign in again."],
    [404, "FILE_NOT_FOUND", "That file could not be found. It may have been removed."],
    [500, "INTERNAL_ERROR", "Something went wrong. Please try again."],
  ])("explains a %i answer next to the file, and saves nothing", async (status, code, shown) => {
    const { server, user } = await openFiles();
    server.file = () => errorResponse(status, code, "A message of the server");

    await user.click(screen.getByRole("button", { name: "Download brand guide.pdf" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We could not download brand guide.pdf.");
    expect(alert).toHaveTextContent(shown);
    expect(saved).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Download brand guide.pdf" })).toBeEnabled();
  });

  it("explains it when the server cannot be reached, and works again on the next try", async () => {
    const { server, user } = await openFiles();
    server.file = () => Promise.reject(new TypeError("Failed to fetch"));
    await user.click(screen.getByRole("button", { name: "Download brand guide.pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not reach the server. Check your connection and try again.");

    server.file = undefined;
    await user.click(screen.getByRole("button", { name: "Download brand guide.pdf" }));

    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says it in Spanish on the Spanish address", async () => {
    const server = mockRequestsApi([withFiles]);
    server.file = () => errorResponse(404, "FILE_NOT_FOUND", "That file doesn't exist.");
    const { user } = await open(`/es/account/requests?request=${idB}`);

    await user.click(await screen.findByRole("button", { name: "Descargar brand guide.pdf" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No pudimos descargar brand guide.pdf.");
    expect(alert).toHaveTextContent("No encontramos ese archivo. Puede que lo hayan quitado.");
  });
});

describe("keeping up with the changes of an admin", () => {
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  it("reads the list again when Refresh is pressed, and shows the new status", async () => {
    const server = mockRequestsApi([apiRequest(idA)]);
    const { user } = await open();
    expect(await screen.findByRole("link", { name: /Ecuador 72%/ })).toHaveTextContent("Submitted");

    // an admin quotes the request
    server.items = [apiRequest(idA, { status: "quoted", quoteAmount: 125000 })];
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await vi.waitFor(() => expect(screen.getByRole("link", { name: /Ecuador 72%/ })).toHaveTextContent("Quoted"));
    expect(screen.getByRole("link", { name: /Ecuador 72%/ })).toHaveTextContent("$1,250.00");
    expect(server.calls.filter((entry) => entry.url === "/api/b2b/requests?limit=100")).toHaveLength(2);
  });

  it("tells screen readers which request changed", async () => {
    const server = mockRequestsApi([apiRequest(idA), apiRequest(idB, { cacaoProfile: "Peru 68%" })]);
    const { user } = await open();
    await screen.findByRole("link", { name: /Ecuador 72%/ });

    server.items = [apiRequest(idA, { status: "quoted", quoteAmount: 125000 }), apiRequest(idB, { status: "rejected", cacaoProfile: "Peru 68%" })];
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await vi.waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Request SC-18293A4B is now quoted. Request SC-18293A4C is now rejected."));
  });

  it("says nothing when nothing changed", async () => {
    mockRequestsApi([apiRequest(idA)]);
    const { user } = await open();
    await screen.findByRole("link", { name: /Ecuador 72%/ });

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled());

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("updates the open details too, with the quote the admin wrote", async () => {
    const server = mockRequestsApi([apiRequest(idA)]);
    const { user } = await open(`/en/account/requests?request=${idA}`);
    const details = await screen.findByRole("region", { name: "Request SC-18293A4B" });
    expect(within(details).getByText("Submitted")).toBeInTheDocument();

    server.items = [apiRequest(idA, { status: "quoted", quoteAmount: 250000, quoteNote: "Includes shipping." })];
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await vi.waitFor(() => expect(within(screen.getByRole("region", { name: "Request SC-18293A4B" })).getByText("Quoted")).toBeInTheDocument());
    expect(within(screen.getByRole("region", { name: "Request SC-18293A4B" })).getByText("$2,500.00")).toBeInTheDocument();
    expect(screen.getByText("Includes shipping.")).toBeInTheDocument();
  });

  it("reads the list again when the person comes back to the tab", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const server = mockRequestsApi([apiRequest(idA)]);
    await open();
    await screen.findByRole("link", { name: /Ecuador 72%/ });

    server.items = [apiRequest(idA, { status: "approved", quoteAmount: 125000 })];
    vi.setSystemTime(Date.now() + 6000);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await vi.waitFor(() => expect(screen.getByRole("link", { name: /Ecuador 72%/ })).toHaveTextContent("Approved"));
  });

  it("does not read it again when the tab was left and came back within a few seconds", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const server = mockRequestsApi([apiRequest(idA)]);
    await open();
    await screen.findByRole("link", { name: /Ecuador 72%/ });

    vi.setSystemTime(Date.now() + 1000);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(server.calls).toHaveLength(1);
  });

  it("does not read it again while the tab is hidden", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const server = mockRequestsApi([apiRequest(idA)]);
    await open();
    await screen.findByRole("link", { name: /Ecuador 72%/ });

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    vi.setSystemTime(Date.now() + 60_000);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(server.calls).toHaveLength(1);
  });

  it("keeps the list that is there when reading it again fails, and offers to try again", async () => {
    const server = mockRequestsApi([apiRequest(idA)]);
    const { user } = await open();
    await screen.findByRole("link", { name: /Ecuador 72%/ });

    server.list = () => errorResponse(500, "INTERNAL_ERROR", "Something went wrong on our side.");
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We could not load your quote requests.");
    expect(screen.getByRole("link", { name: /Ecuador 72%/ })).toBeInTheDocument();

    server.list = undefined;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await vi.waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Ecuador 72%/ })).toBeInTheDocument();
  });

  it("shows that it is updating while the list is read again", async () => {
    const server = mockRequestsApi([apiRequest(idA)]);
    const { user } = await open();
    await screen.findByRole("link", { name: /Ecuador 72%/ });
    let answer: (response: Response) => void = () => {};
    server.list = () => new Promise<Response>((resolve) => (answer = resolve));

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(screen.getByRole("button", { name: "Updating..." })).toBeDisabled();
    expect(screen.getByRole("link", { name: /Ecuador 72%/ })).toBeInTheDocument();

    await act(async () => answer(jsonResponse({ items: [apiRequest(idA)], total: 1 })));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled());
  });
});
