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
// The studio is only for business accounts, so it is opened as one unless the test says otherwise (account: null is a guest).
export async function openRoute(page: Page, path: string, options: { account?: Account | null } = {}) {
  const account = options.account === undefined && path.includes("/wholesale/studio") ? "business" : options.account;
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
