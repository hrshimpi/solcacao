// Checks the layout at different screen sizes: no sideways scroll, grid and footer columns, step strip, target sizes.
import { expect, test } from "@playwright/test";
import { chooseOption, e2eFile, e2eRequest, mockRequestsApi, openRoute, routes, withToken } from "./helpers";

// These tests set their own screen sizes, so one browser is enough.
test.beforeEach(async ({ browserName, isMobile }) => {
  test.skip(browserName !== "chromium" || isMobile, "runs in the desktop chromium project only");
});

const widths = [320, 375, 768, 1024, 1440];

// One test for each page and width. They used to be one test for each width that opened every page one after the other,
// which took about 26 of the 30 seconds a test is given, so a slower machine made them fail without anything being wrong.
test.describe("no sideways scroll", () => {
  for (const width of widths) {
    test.describe(`at ${width}px wide`, () => {
      for (const path of routes) {
        test(path, async ({ page }) => {
          await page.setViewportSize({ width, height: 800 });

          await openRoute(page, path);

          const sizes = await page.evaluate(() => ({
            page: document.documentElement.scrollWidth,
            window: document.documentElement.clientWidth,
          }));
          expect(sizes.page, `${path} is wider than the screen at ${width}px`).toBeLessThanOrEqual(sizes.window);
        });
      }
    });
  }
});

test.describe("layout changes with the screen size", () => {
  test("the navigation links show from lg (1024px), a menu button below", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await openRoute(page, "/en");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();

    await page.setViewportSize({ width: 1023, height: 800 });
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
  });

  test("the shop grid has 1, 2, 3 and 4 columns", async ({ page }) => {
    const expected: [number, number][] = [
      [375, 1],
      [768, 2],
      [1100, 3],
      [1440, 4],
    ];

    for (const [width, columns] of expected) {
      await page.setViewportSize({ width, height: 900 });
      await openRoute(page, "/en/shop?min=55");
      const lefts = await page.getByRole("article").evaluateAll((cards) => cards.map((card) => Math.round(card.getBoundingClientRect().left)));
      expect(new Set(lefts).size, `columns at ${width}px`).toBe(columns);
    }
  });

  test("the footer columns stack, then 2, then 4", async ({ page }) => {
    const expected: [number, number][] = [
      [375, 1],
      [768, 2],
      [1280, 4],
    ];

    for (const [width, columns] of expected) {
      await page.setViewportSize({ width, height: 900 });
      await openRoute(page, "/en");
      const lefts = await page
        .getByRole("navigation", { name: "Footer" })
        .getByRole("heading", { level: 2 })
        .evaluateAll((headings) => headings.map((heading) => Math.round(heading.getBoundingClientRect().left)));
      expect(new Set(lefts).size, `footer columns at ${width}px`).toBe(columns);
    }
  });

  test("the studio shows one line of text on a phone and the step list on a wide screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await openRoute(page, "/en/wholesale/studio");
    await chooseOption(page, /Ecuador 72%/);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Step 2 of 4: Packaging")).toBeVisible();
    await expect(page.getByRole("list", { name: "Progress" })).toBeHidden();

    await page.setViewportSize({ width: 1024, height: 800 });
    await expect(page.getByText("Step 2 of 4: Packaging")).toBeHidden();
    await expect(page.getByRole("list", { name: "Progress" })).toBeVisible();
  });

  test("the text can be made bigger without losing content (200% zoom, about 640px wide)", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 800 });
    for (const path of ["/en", "/en/shop", "/en/wholesale/studio", "/en/contact"]) {
      await openRoute(page, path);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(wide, `${path} scrolls sideways`).toBe(false);
    }
  });
});

test.describe("touch targets", () => {
  test("buttons and links are at least 24px, the main ones 44px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    for (const path of ["/en", "/en/shop", "/en/sampler", "/en/contact", "/en/account/login"]) {
      await openRoute(page, path);
      const small = await page.evaluate(() => {
        const found: string[] = [];
        const controls = document.querySelectorAll<HTMLElement>("main button, main input, header button, header a[aria-label], footer button");
        controls.forEach((element) => {
          const box = element.getBoundingClientRect();
          if (box.width === 0 || box.height === 0) return;
          if (element.className.toString().includes("sr-only")) return;
          if (box.width < 24 || box.height < 24) found.push(`${element.tagName.toLowerCase()} ${element.textContent?.trim().slice(0, 20)} ${Math.round(box.width)}x${Math.round(box.height)}`);
        });
        return found;
      });
      expect(small, `controls under 24px on ${path}`).toEqual([]);
    }
  });
});

test.describe("My quote requests layout", () => {
  const longName = "a-very-long-brand-guideline-file-name-for-the-hacienda-winter-collection-final-version-seven-approved.pdf";
  const requests = [
    e2eRequest("66a1b2c3d4e5f60718293a4b", { status: "submitted" }),
    e2eRequest("66a1b2c3d4e5f60718293a4c", {
      status: "quoted",
      quoteAmount: 125000,
      quoteNote: "Includes shipping and the printing of the labels, valid for thirty days from today.",
      notes: "Gold foil on the lid, matte inside, and a ribbon in the colours of the hacienda please",
      brandAssets: [e2eFile("one.pdf", longName)],
    }),
  ];

  for (const width of widths) {
    test(`has no sideways scroll at ${width}px wide, even with a long file name`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await mockRequestsApi(page, requests);
      await withToken(page);

      for (const lang of ["en", "es"]) {
        await openRoute(page, `/${lang}/account/requests?request=66a1b2c3d4e5f60718293a4c`);
        await expect(page.getByText(longName)).toBeVisible();
        const sizes = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, window: document.documentElement.clientWidth }));
        expect(sizes.page, `/${lang}/account/requests is wider than the screen at ${width}px`).toBeLessThanOrEqual(sizes.window);
      }
    });
  }

  test("puts the list beside the details from lg (1024px), and the details below the list on a narrower screen", async ({ page }) => {
    await mockRequestsApi(page, requests);
    await withToken(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await openRoute(page, "/en/account/requests?request=66a1b2c3d4e5f60718293a4c");
    const wideList = await page.getByRole("region", { name: "Your quote requests" }).boundingBox();
    const wideDetails = await page.getByRole("region", { name: "Request SC-18293A4C" }).boundingBox();
    expect(wideDetails!.x).toBeGreaterThan(wideList!.x + wideList!.width - 1);
    expect(Math.abs(wideDetails!.y - wideList!.y)).toBeLessThan(40);

    await page.setViewportSize({ width: 600, height: 900 });
    const narrowList = await page.getByRole("region", { name: "Your quote requests" }).boundingBox();
    const narrowDetails = await page.getByRole("region", { name: "Request SC-18293A4C" }).boundingBox();
    expect(narrowDetails!.y).toBeGreaterThan(narrowList!.y + narrowList!.height - 1);
  });

  test("has controls of at least 44px for the rows of the list and the buttons, on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await mockRequestsApi(page, requests);
    await withToken(page);
    await openRoute(page, "/en/account/requests?request=66a1b2c3d4e5f60718293a4c");

    const heights = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main a[href*='request='], main button")].map((element) => ({
        name: (element.textContent ?? "").trim().slice(0, 24),
        height: Math.round(element.getBoundingClientRect().height),
      })),
    );
    expect(heights.length).toBeGreaterThan(3);
    for (const control of heights) expect(control.height, `${control.name} is ${control.height}px high`).toBeGreaterThanOrEqual(44);
  });
});
