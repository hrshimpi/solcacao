// Browser tests of the main flows (language, filters, cart, sampler, studio, forms, skip link).
import { expect, test } from "@playwright/test";
import { goToPage, openRoute, chooseOption } from "./helpers";

test.describe("smoke flows", () => {
  test("the address / goes to a language page", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/(en|es)$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("pages load without errors in the console", async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(message.text());
    });

    for (const path of ["/en", "/en/shop", "/en/sampler", "/en/contact", "/es/wholesale"]) {
      await openRoute(page, path);
    }

    // images from the internet can fail in a locked down network, that is not a problem with the app
    expect(problems.filter((text) => !/Failed to load resource|net::ERR/.test(text))).toEqual([]);
  });

  test("the skip link jumps to the main content", async ({ page, isMobile, browserName }) => {
    test.skip(isMobile, "needs a keyboard");
    // Safari and WebKit skip links when you press Tab (a browser setting), so this has to be tested by hand there
    test.skip(browserName === "webkit", "WebKit does not Tab to links by default");
    await openRoute(page, "/en");

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("a link in the navigation opens the page and focuses its heading", async ({ page }) => {
    await openRoute(page, "/en");

    await goToPage(page, "Wholesale");

    await expect(page).toHaveURL(/\/en\/wholesale$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(page).toHaveTitle("Wholesale | SolCacao");
  });

  test("the language buttons change the page and the html language", async ({ page }) => {
    await openRoute(page, "/en/shop");

    const menu = page.getByRole("button", { name: "Menu" });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole("button", { name: "ES, Español" }).click();

    await expect(page).toHaveURL(/\/es\/shop$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", { level: 1, name: "La colección" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ES, Español" }).first()).toHaveAttribute("aria-pressed", "true");
  });

  test("a shop filter goes into the address and survives a reload", async ({ page }) => {
    await openRoute(page, "/en/shop?min=55");

    const filters = page.getByRole("button", { name: "Filters" });
    if (await filters.isVisible()) await filters.click();
    await chooseOption(page, "Peru");

    await expect(page).toHaveURL(/origin=peru/);
    await page.reload();
    await expect(page.getByRole("article")).toHaveCount(1);
  });

  test("the cart keeps its items after a reload", async ({ page }) => {
    await openRoute(page, "/en/shop?min=55");

    await page.getByRole("button", { name: /^Add to cart, / }).first().click();
    const dialog = page.getByRole("dialog", { name: "Your cart" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.reload();
    await expect(page.getByRole("button", { name: "Cart, 1 item" })).toBeVisible();
  });

  test("a product page adds the chosen quantity to the cart", async ({ page }) => {
    await openRoute(page, "/en/shop/ecuador-72");

    await page.getByRole("button", { name: "Increase quantity" }).click();
    await page.getByRole("button", { name: /Add to cart/ }).click();

    await expect(page.getByRole("dialog", { name: "Your cart" })).toContainText("Ecuador 72%");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Cart, 2 items" })).toBeVisible();
  });

  test("the sampler is added to the cart as one item", async ({ page }) => {
    await openRoute(page, "/en/sampler");

    const tiles = page.getByRole("button", { pressed: false }).filter({ has: page.locator("img") });
    for (let i = 0; i < 4; i++) await tiles.first().click();
    await expect(page.getByRole("main").getByText("4 of 6 chosen")).toBeVisible();

    await page.getByRole("button", { name: "Add sampler to cart" }).click();
    await expect(page.getByRole("dialog", { name: "Your cart" })).toContainText("Custom sampler");
  });

  test("the studio wizard can be completed", async ({ page }) => {
    await openRoute(page, "/en/wholesale/studio");

    await chooseOption(page, /Ecuador 72%/);
    await page.getByRole("button", { name: "Continue" }).click();
    await chooseOption(page, /Rigid gift box/);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel(/Company name/).fill("Hacienda Brands");
    await page.getByLabel(/Contact name/).fill("Isabel Vasquez");
    await page.getByLabel(/Estimated units/).fill("800");
    await page.getByRole("button", { name: "Submit for quote" }).click();

    await expect(page.getByRole("heading", { name: "We have your brief." })).toBeVisible();
  });

  test("the contact form shows errors, then a confirmation", async ({ page }) => {
    await openRoute(page, "/en/contact");
    const main = page.getByRole("main");

    await main.getByRole("button", { name: "Send message" }).click();
    await expect(main.getByLabel(/Name/)).toHaveAttribute("aria-invalid", "true");
    await expect(main.getByLabel(/Name/)).toBeFocused();

    await main.getByLabel(/Name/).fill("Isabel");
    await main.getByLabel(/Email/).fill("isabel@example.com");
    await main.getByLabel(/Message/).fill("Do you ship to Canada?");
    await main.getByRole("button", { name: "Send message" }).click();

    await expect(main.getByRole("heading", { name: "Message received." })).toBeVisible();
  });

  test("an unknown address shows the not found page", async ({ page }) => {
    await page.goto("/en/nothing-here");

    await expect(page.getByRole("heading", { level: 1, name: /couldn't find that page/i })).toBeVisible();
  });
});
