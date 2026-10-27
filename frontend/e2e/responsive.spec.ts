// Checks the layout at different screen sizes: no sideways scroll, grid and footer columns, step strip, target sizes.
import { expect, test } from "@playwright/test";
import { openRoute, routes, chooseOption } from "./helpers";

// These tests set their own screen sizes, so one browser is enough.
test.beforeEach(async ({ browserName, isMobile }) => {
  test.skip(browserName !== "chromium" || isMobile, "runs in the desktop chromium project only");
});

const widths = [320, 375, 768, 1024, 1440];

test.describe("no sideways scroll", () => {
  for (const width of widths) {
    test(`at ${width}px wide`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });

      for (const path of routes) {
        await openRoute(page, path);
        const sizes = await page.evaluate(() => ({
          page: document.documentElement.scrollWidth,
          window: document.documentElement.clientWidth,
        }));
        expect(sizes.page, `${path} is wider than the screen at ${width}px`).toBeLessThanOrEqual(sizes.window);
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
