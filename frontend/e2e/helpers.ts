// Small helpers shared by the browser tests.
import { expect, type Page } from "@playwright/test";

export const routes = [
  "/en",
  "/en/shop",
  "/en/shop/ecuador-72",
  "/en/wholesale",
  "/en/wholesale/studio",
  "/en/sampler",
  "/en/contact",
  "/en/account/login",
  "/en/account/register",
  "/en/profile",
  "/en/no-such-page",
  "/es",
  "/es/shop",
  "/es/shop/ecuador-72",
  "/es/wholesale",
  "/es/wholesale/studio",
  "/es/sampler",
  "/es/contact",
  "/es/account/login",
  "/es/account/register",
  "/es/profile",
];

// on a phone the page links are inside the menu dialog, on a wide screen they are in the header
export async function goToPage(page: Page, name: string | RegExp) {
  const menu = page.getByRole("button", { name: "Menu" });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name }).click();
  } else {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }).click();
  }
}

export type Account = "retail" | "business";

// signs someone in before any page of this test loads. The preview sign in keeps the user in sessionStorage.
export async function signInAs(page: Page, accountType: Account) {
  await page.addInitScript((user) => sessionStorage.setItem("sc_user", JSON.stringify(user)), { email: "isabel@example.com", accountType });
}

// the page is ready when its heading is there, the web fonts have loaded and the entrance animations are done
// (a scan in the middle of a fade-in would measure half see-through colours)
// The studio and My quote requests are only for business accounts, so they are opened as one unless the test says otherwise (account: null is a guest).
export async function openRoute(page: Page, path: string, options: { account?: Account | null } = {}) {
  const account = options.account === undefined && /\/(wholesale\/studio|account\/requests)/.test(path) ? "business" : options.account;
  if (account) await signInAs(page, account);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.allSettled(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished)));
}

// clicks the visible label of a radio button or checkbox, the way a person would
export async function chooseOption(page: Page, text: string | RegExp) {
  await page.locator("label:visible").filter({ hasText: text }).first().click();
}

export interface QuoteAnswer {
  status: number;
  body: unknown;
}

export const quoteSaved: QuoteAnswer = { status: 201, body: { request: { id: "66a1b2c3d4e5f60718293a4b", status: "submitted" } } };
export const quoteFailed: QuoteAnswer = {
  status: 500,
  body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side.", details: [] } },
};

// answers the quote endpoint like the server would, so no test needs a backend, and keeps what was sent to it
export async function mockQuoteApi(page: Page, options: { answer?: QuoteAnswer; delayMs?: number } = {}) {
  const state = { answer: options.answer ?? quoteSaved, requests: [] as { headers: Record<string, string>; body: string }[] };
  await page.route("**/api/b2b/quote", async (route) => {
    const request = route.request();
    // the body is only read as text to look for the names of the fields and files, never to rebuild them
    state.requests.push({ headers: request.headers(), body: request.postDataBuffer()?.toString("latin1") ?? "" });
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    await route.fulfill({ status: state.answer.status, contentType: "application/json", body: JSON.stringify(state.answer.body) });
  });
  return state;
}

// goes through the studio up to the review step and fills it in, with files on the files step when there are any
export async function fillStudio(page: Page, files: { name: string; mimeType: string; buffer: Buffer }[] = []) {
  await chooseOption(page, /Ecuador 72%/);
  await page.getByRole("button", { name: "Continue" }).click();
  await chooseOption(page, /Rigid gift box/);
  await page.getByRole("button", { name: "Continue" }).click();
  if (files.length > 0) await page.locator("input[type=file]").setInputFiles(files);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/Company name/).fill("Hacienda Brands");
  await page.getByLabel(/Contact name/).fill("Isabel Vasquez");
  await page.getByLabel(/Estimated units/).fill("800");
}

// five featured products, as the API sends them (prices in cents)
const featured = ["ecuador-72", "peru-68", "venezuela-76", "colombia-64", "madagascar-80"].map((slug, index) => ({
  id: `p${index}`,
  slug,
  name: slug.replace(/-(\d+)$/, " $1%").replace(/^./, (letter) => letter.toUpperCase()),
  tastingSummary: `flavor line ${index + 1}`,
  price: 1000 + index * 100,
  images: [`https://images.unsplash.com/photo-1575377427642-087cf684f29d?w=480&h=600&fit=crop&auto=format`],
}));

// makes the featured products request answer with five products, after an optional wait
export async function mockFeaturedProducts(page: Page, options: { delayMs?: number } = {}) {
  await page.route("**/api/products?**", async (route) => {
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    await route.fulfill({ json: { items: featured, page: 1, limit: 5, total: 5 } });
  });
}

// makes the same request fail
export async function failFeaturedProducts(page: Page, how: "error" | "offline") {
  await page.route("**/api/products?**", (route) => (how === "offline" ? route.abort("connectionrefused") : route.fulfill({ status: 500, json: { error: { code: "INTERNAL_ERROR" } } })));
}

// ---------- the quote requests of a business account ----------

export const requestToken = "e2e-token";

export function e2eRequest(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    userId: "66a1b2c3d4e5f60718290000",
    companyName: "Hacienda Brands",
    contactName: "Isabel Vasquez",
    cacaoProfile: "Ecuador 72%",
    packagingType: "rigid_box",
    quantityEstimate: 800,
    notes: "",
    brandAssets: [],
    status: "submitted",
    quoteAmount: null,
    createdAt: "2026-10-26T12:00:00.000Z",
    updatedAt: "2026-10-26T12:00:00.000Z",
    ...extra,
  };
}

export const e2eFile = (storedName: string, originalName: string) => ({
  originalName,
  storedName,
  mimeType: "application/pdf",
  sizeBytes: 2048,
  uploadedAt: "2026-10-26T12:00:00.000Z",
});

// gives the browser tab a token, like the real sign in will, so the calls that need one can be checked for it
export async function withToken(page: Page, token = requestToken) {
  await page.addInitScript((value) => sessionStorage.setItem("sc_token", value), token);
}

// answers the list of the requests and their files like the server would, and remembers every call with its Authorization header.
// Change state.items between calls to play an admin changing a request, and set state.status to make the list fail.
export async function mockRequestsApi(page: Page, items: unknown[] = []) {
  const state = {
    items,
    status: 200,
    fileContent: "%PDF-1.4 e2e file",
    calls: [] as { path: string; authorization: string | undefined }[],
  };
  await page.route("**/api/b2b/requests**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    state.calls.push({ path: url.pathname + url.search, authorization: request.headers().authorization });

    if (url.pathname === "/api/b2b/requests") {
      if (state.status !== 200) {
        await route.fulfill({ status: state.status, json: { error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side.", details: [] } } });
        return;
      }
      await route.fulfill({ json: { items: state.items, page: 1, limit: 100, total: state.items.length, totalPages: 1 } });
      return;
    }
    if (/^\/api\/b2b\/requests\/[^/]+\/assets\/[^/]+$/.test(url.pathname)) {
      await route.fulfill({ status: 200, contentType: "application/pdf", headers: { "Content-Disposition": "attachment" }, body: state.fileContent });
      return;
    }
    await route.fallback();
  });
  return state;
}
