// Runs axe on every route, on the open dialogs and on each studio step. Fails on any WCAG 2.2 AA problem.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { chooseOption, e2eFile, e2eRequest, fillStudio, mockFeaturedProducts, mockQuoteApi, mockRequestsApi, openRoute, quoteFailed, quoteSaved, routes, withToken } from "./helpers";

const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  return results.violations.map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`);
}

test.describe("axe scan of every route", () => {
  for (const path of routes) {
    test(path, async ({ page }) => {
      await openRoute(page, path);

      expect(await scan(page)).toEqual([]);
    });
  }
});

test.describe("axe scan of the studio access pages", () => {
  test("the sign in page a guest is sent to", async ({ page }) => {
    await openRoute(page, "/en/wholesale/studio", { account: null });
    await expect(page).toHaveURL(/\/en\/account\/login\?next=%2Fwholesale%2Fstudio$/);

    expect(await scan(page)).toEqual([]);
  });

  for (const path of ["/en/wholesale/studio", "/es/wholesale/studio"]) {
    test(`the message for a retail account at ${path}`, async ({ page }) => {
      await openRoute(page, path, { account: "retail" });
      await expect(page.getByRole("link", { name: /^(Create a business account|Crear una cuenta de empresa)$/ })).toBeVisible();

      expect(await scan(page)).toEqual([]);
    });
  }
});

test.describe("axe scan of open dialogs and steps", () => {
  test("the home page with the showcase loaded", async ({ page }) => {
    await mockFeaturedProducts(page);
    await openRoute(page, "/en");
    await expect(page.getByRole("article")).toHaveCount(5);

    expect(await scan(page)).toEqual([]);
  });

  test("the cart dialog", async ({ page }) => {
    await openRoute(page, "/en/shop?min=55");
    await page.getByRole("button", { name: /^Add to cart, / }).first().click();
    await expect(page.getByRole("dialog", { name: "Your cart" })).toBeVisible();

    expect(await scan(page)).toEqual([]);
  });

  test("the search dialog", async ({ page }) => {
    await openRoute(page, "/en");
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByRole("searchbox").fill("peru");
    await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();

    expect(await scan(page)).toEqual([]);
  });

  test("the menu dialog", async ({ page }) => {
    await openRoute(page, "/en");
    const menu = page.getByRole("button", { name: "Menu" });
    test.skip(!(await menu.isVisible()), "the menu button only shows below the lg breakpoint");
    await menu.click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();

    expect(await scan(page)).toEqual([]);
  });

  test("every step of the studio wizard", async ({ page }) => {
    // four scans and the clicks between them take about 15 seconds in WebKit, half of what a test is given
    test.slow();
    await openRoute(page, "/en/wholesale/studio");
    expect(await scan(page)).toEqual([]);

    await chooseOption(page, /Ecuador 72%/);
    await page.getByRole("button", { name: "Continue" }).click();
    expect(await scan(page)).toEqual([]);

    await chooseOption(page, /Paper sleeve/);
    await page.getByRole("button", { name: "Continue" }).click();
    expect(await scan(page)).toEqual([]);

    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Submit for quote" }).click();
    expect(await scan(page)).toEqual([]);
  });

  test("the review step with the small run warning showing", async ({ page }) => {
    await openRoute(page, "/en/wholesale/studio");
    await chooseOption(page, /Ecuador 72%/);
    await page.getByRole("button", { name: "Continue" }).click();
    await chooseOption(page, /Paper sleeve/);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel(/Estimated units/).fill("100");
    await page.getByLabel(/Company name/).focus();
    await expect(page.getByLabel(/Estimated units/)).toHaveAccessibleDescription(/under our usual minimum of 500 units/);

    expect(await scan(page)).toEqual([]);
  });

  test("the studio when a request could not be sent, and when it was saved", async ({ page }) => {
    const quote = await mockQuoteApi(page, { answer: quoteFailed });
    await openRoute(page, "/en/wholesale/studio");
    await fillStudio(page);
    await page.getByRole("button", { name: "Submit for quote" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    expect(await scan(page)).toEqual([]);

    quote.answer = quoteSaved;
    await page.getByRole("button", { name: "Submit for quote" }).click();
    await expect(page.getByRole("heading", { name: "We have your brief." })).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });

  test("the studio while a request with files is being sent", async ({ page }) => {
    await mockQuoteApi(page, { delayMs: 3000 });
    await openRoute(page, "/en/wholesale/studio");
    await fillStudio(page, [{ name: "logo.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") }]);
    await page.getByRole("button", { name: "Submit for quote" }).click();
    await expect(page.getByRole("progressbar")).toBeVisible();

    expect(await scan(page)).toEqual([]);
  });

  test("forms with error messages showing", async ({ page }) => {
    await openRoute(page, "/en/contact");
    await page.getByRole("main").getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("main").getByLabel(/Name/)).toHaveAttribute("aria-invalid", "true");

    expect(await scan(page)).toEqual([]);
  });
});

test.describe("axe scan of My quote requests", () => {
  // one request in each status, so every badge colour is scanned, and one with a quote, notes and a file
  const requests = [
    e2eRequest("66a1b2c3d4e5f60718293a4b", { status: "submitted" }),
    e2eRequest("66a1b2c3d4e5f60718293a4c", {
      status: "quoted",
      quoteAmount: 125000,
      quoteNote: "Includes shipping.",
      notes: "Gold foil on the lid",
      cacaoProfile: "Peru 68%",
      packagingType: "foil_wrap",
      brandAssets: [e2eFile("one.pdf", "brand guide.pdf")],
    }),
    e2eRequest("66a1b2c3d4e5f60718293a4d", { status: "approved", quoteAmount: 99900, cacaoProfile: "Custom blend" }),
    e2eRequest("66a1b2c3d4e5f60718293a4e", { status: "rejected", cacaoProfile: "Madagascar 80%" }),
  ];

  for (const lang of ["en", "es"]) {
    test(`the list with a request open at /${lang}/account/requests`, async ({ page }) => {
      await mockRequestsApi(page, requests);
      await withToken(page);
      await openRoute(page, `/${lang}/account/requests?request=66a1b2c3d4e5f60718293a4c`);
      await expect(page.getByRole("region", { name: /^(Request|Solicitud) SC-18293A4C$/ })).toBeVisible();

      expect(await scan(page)).toEqual([]);
    });
  }

  test("the empty state", async ({ page }) => {
    await mockRequestsApi(page, []);
    await withToken(page);
    await openRoute(page, "/en/account/requests");
    await expect(page.getByRole("heading", { name: "You have not sent a quote request yet." })).toBeVisible();

    expect(await scan(page)).toEqual([]);
  });

  test("the problem when the list cannot be loaded", async ({ page }) => {
    const server = await mockRequestsApi(page, requests);
    server.status = 500;
    await withToken(page);
    await openRoute(page, "/en/account/requests");
    await expect(page.getByRole("alert")).toBeVisible();

    expect(await scan(page)).toEqual([]);
  });

  test("the loading state", async ({ page }) => {
    await page.route("**/api/b2b/requests**", () => new Promise(() => {}));
    await withToken(page);
    await openRoute(page, "/en/account/requests");
    await expect(page.getByText("Loading your quote requests...")).toBeVisible();

    expect(await scan(page)).toEqual([]);
  });

  test("a file that could not be downloaded", async ({ page }) => {
    await mockRequestsApi(page, requests);
    await page.route("**/api/b2b/requests/*/assets/*", (route) =>
      route.fulfill({ status: 404, json: { error: { code: "FILE_NOT_FOUND", message: "That file does not exist.", details: [] } } }),
    );
    await withToken(page);
    await openRoute(page, "/en/account/requests?request=66a1b2c3d4e5f60718293a4c");
    await page.getByRole("button", { name: "Download brand guide.pdf" }).click();
    await expect(page.getByRole("alert")).toContainText("We could not download brand guide.pdf.");

    expect(await scan(page)).toEqual([]);
  });

  test("the message for a retail account", async ({ page }) => {
    await openRoute(page, "/en/account/requests", { account: "retail" });
    await expect(page.getByRole("heading", { level: 1, name: "Quote requests are for business accounts" })).toBeVisible();

    expect(await scan(page)).toEqual([]);
  });

  test("the account page of a business account, with the link to the requests", async ({ page }) => {
    await openRoute(page, "/en/profile", { account: "business" });
    await expect(page.getByRole("region", { name: "Wholesale" })).toBeVisible();

    expect(await scan(page)).toEqual([]);
  });
});
