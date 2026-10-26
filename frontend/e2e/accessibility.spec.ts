// Runs axe on every route, on the open dialogs and on each studio step. Fails on any WCAG 2.2 AA problem.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { chooseOption, mockFeaturedProducts, openRoute, routes } from "./helpers";

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

  test("forms with error messages showing", async ({ page }) => {
    await openRoute(page, "/en/contact");
    await page.getByRole("main").getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("main").getByLabel(/Name/)).toHaveAttribute("aria-invalid", "true");

    expect(await scan(page)).toEqual([]);
  });
});
