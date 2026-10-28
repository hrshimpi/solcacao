// Browser tests of the main flows (language, filters, cart, sampler, studio, forms, skip link).
import { expect, test } from "@playwright/test";
import {
  chooseOption,
  e2eFile,
  e2eRequest,
  failFeaturedProducts,
  fillStudio,
  goToPage,
  mockFeaturedProducts,
  mockQuoteApi,
  mockRequestsApi,
  openRoute,
  quoteFailed,
  quoteSaved,
  withToken,
} from "./helpers";

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

  test("the studio wizard can be completed, and shows the reference and where to go next", async ({ page }) => {
    await mockQuoteApi(page);
    await openRoute(page, "/en/wholesale/studio");

    await fillStudio(page);
    await page.getByRole("button", { name: "Submit for quote" }).click();

    await expect(page.getByRole("heading", { name: "We have your brief." })).toBeVisible();
    await expect(page.getByText("SC-18293A4B")).toBeVisible();
    await expect(page.getByRole("link", { name: "My quote requests" })).toHaveAttribute("href", "/en/account/requests?request=66a1b2c3d4e5f60718293a4b");
    await expect(page.getByRole("link", { name: "Back to Wholesale" })).toHaveAttribute("href", "/en/wholesale");
  });

  test("a quote request goes to the server as a multipart form with the brand files", async ({ page }) => {
    const quote = await mockQuoteApi(page);
    await openRoute(page, "/en/wholesale/studio");
    await fillStudio(page, [
      { name: "logo.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") },
      { name: "mark.png", mimeType: "image/png", buffer: Buffer.from("png bytes") },
    ]);

    await page.getByRole("button", { name: "Submit for quote" }).click();
    await expect(page.getByRole("heading", { name: "We have your brief." })).toBeVisible();

    expect(quote.requests).toHaveLength(1);
    const { headers, body } = quote.requests[0];
    expect(headers["content-type"]).toMatch(/^multipart\/form-data; boundary=/);
    expect(body).toContain('name="cacaoProfile"');
    expect(body).toContain("Ecuador 72%");
    expect(body).toContain('name="packagingType"');
    expect(body).toContain("rigid_box");
    expect(body).toContain('name="quantityEstimate"');
    expect(body).toContain('name="companyName"');
    expect(body).toContain('name="brandAssets"; filename="logo.pdf"');
    expect(body).toContain('name="brandAssets"; filename="mark.png"');
  });

  test("a request that could not be sent keeps the form and can be sent again", async ({ page }) => {
    const quote = await mockQuoteApi(page, { answer: quoteFailed });
    await openRoute(page, "/en/wholesale/studio");
    await fillStudio(page);

    await page.getByRole("button", { name: "Submit for quote" }).click();

    await expect(page.getByRole("alert")).toContainText("We could not send your request.");
    await expect(page.getByRole("alert")).toContainText("Something went wrong on our side.");
    await expect(page.getByLabel(/Company name/)).toHaveValue("Hacienda Brands");
    await expect(page.getByLabel(/Estimated units/)).toHaveValue("800");

    quote.answer = quoteSaved;
    await page.getByRole("button", { name: "Submit for quote" }).click();
    await expect(page.getByRole("heading", { name: "We have your brief." })).toBeVisible();
    expect(quote.requests).toHaveLength(2);
  });

  for (const [status, code, shown] of [
    [401, "UNAUTHENTICATED", "The server does not know who you are."],
    [403, "FORBIDDEN", "Only business accounts can send a quote request."],
    [413, "FILE_TOO_LARGE", "One of your files is too big. Each file can be up to 50 MB."],
    [429, "RATE_LIMITED", "You have sent a lot of requests. Please try again later."],
    [503, "DATABASE_UNAVAILABLE", "We can't reach the database right now."],
  ] as const) {
    test(`the studio explains a ${status} answer of the server, and keeps what was typed`, async ({ page }) => {
      await mockQuoteApi(page, { answer: { status, body: { error: { code, message: "We can't reach the database right now.", details: [] } } } });
      await openRoute(page, "/en/wholesale/studio");
      await fillStudio(page);

      await page.getByRole("button", { name: "Submit for quote" }).click();

      await expect(page.getByRole("alert")).toContainText(shown);
      await expect(page.getByLabel(/Company name/)).toHaveValue("Hacienda Brands");
      await expect(page.getByLabel(/Estimated units/)).toHaveValue("800");
      await expect(page.getByRole("button", { name: "Submit for quote" })).toBeEnabled();
    });
  }

  test("a request that the server saved, but whose answer cannot be read, is shown as saved", async ({ page }) => {
    const quote = await mockQuoteApi(page, { answer: { status: 201, body: "<html>Created</html>" } });
    await openRoute(page, "/en/wholesale/studio");
    await fillStudio(page);

    await page.getByRole("button", { name: "Submit for quote" }).click();

    await expect(page.getByRole("heading", { name: "We have your brief." })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(quote.requests).toHaveLength(1);
  });

  test("the message about a request that could not be sent stays on the review step", async ({ page }) => {
    await mockQuoteApi(page, { answer: quoteFailed });
    await openRoute(page, "/en/wholesale/studio");
    await fillStudio(page);
    await page.getByRole("button", { name: "Submit for quote" }).click();
    await expect(page.getByRole("alert")).toBeVisible();

    await page.getByRole("button", { name: "Previous step" }).click();

    await expect(page.getByRole("heading", { name: "Upload your brand assets" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("an error of one step does not follow the person back to the step before", async ({ page }) => {
    await openRoute(page, "/en/wholesale/studio");
    await chooseOption(page, /Ecuador 72%/);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Choose a packaging option to continue.")).toBeVisible();

    await page.getByRole("button", { name: "Previous step" }).click();

    await expect(page.getByRole("heading", { name: "Choose your cacao profile" })).toBeVisible();
    await expect(page.getByText("Choose a packaging option to continue.")).toHaveCount(0);
  });

  test("a double click on Submit sends one request", async ({ page }) => {
    const quote = await mockQuoteApi(page, { delayMs: 600 });
    await openRoute(page, "/en/wholesale/studio");
    await fillStudio(page);

    await page.getByRole("button", { name: "Submit for quote" }).dblclick();
    await expect(page.getByRole("heading", { name: "We have your brief." })).toBeVisible();

    expect(quote.requests).toHaveLength(1);
  });

  test("My quote requests lists the requests with their status, and opens the details of one", async ({ page }) => {
    const server = await mockRequestsApi(page, [
      e2eRequest("66a1b2c3d4e5f60718293a4b", { status: "submitted" }),
      e2eRequest("66a1b2c3d4e5f60718293a4c", {
        status: "quoted",
        quoteAmount: 125000,
        quoteNote: "Includes shipping.",
        cacaoProfile: "Peru 68%",
        packagingType: "foil_wrap",
        quantityEstimate: 1200,
        brandAssets: [e2eFile("one.pdf", "brand guide.pdf")],
      }),
    ]);
    await withToken(page);
    await openRoute(page, "/en/account/requests");

    const rows = page.getByRole("region", { name: "Your quote requests" }).getByRole("link");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("Submitted");
    await expect(rows.nth(1)).toContainText("Quoted");
    await expect(rows.nth(1)).toContainText("$1,250.00");

    await rows.nth(1).click();
    await expect(page).toHaveURL(/\/en\/account\/requests\?request=66a1b2c3d4e5f60718293a4c$/);
    await expect(page.getByRole("heading", { name: "Request SC-18293A4C" })).toBeFocused();
    await expect(page.getByText("Includes shipping.")).toBeVisible();
    await expect(page.getByText("brand guide.pdf")).toBeVisible();
    expect(server.calls[0].authorization).toBe("Bearer e2e-token");
  });

  test("a file of a request downloads with the token, under the name it was uploaded with", async ({ page }) => {
    const server = await mockRequestsApi(page, [e2eRequest("66a1b2c3d4e5f60718293a4b", { brandAssets: [e2eFile("one.pdf", "brand guide.pdf")] })]);
    server.fileContent = "the bytes of the guide";
    await withToken(page);
    await openRoute(page, "/en/account/requests?request=66a1b2c3d4e5f60718293a4b");

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download brand guide.pdf" }).click()]);

    expect(download.suggestedFilename()).toBe("brand guide.pdf");
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe("the bytes of the guide");
    const call = server.calls.find((entry) => entry.path.includes("/assets/"));
    expect(call?.path).toBe("/api/b2b/requests/66a1b2c3d4e5f60718293a4b/assets/one.pdf");
    expect(call?.authorization).toBe("Bearer e2e-token");
  });

  test("a status that an admin changed shows up when the list is refreshed", async ({ page }) => {
    const server = await mockRequestsApi(page, [e2eRequest("66a1b2c3d4e5f60718293a4b", { status: "submitted" })]);
    await withToken(page);
    await openRoute(page, "/en/account/requests");
    await expect(page.getByRole("link", { name: /Ecuador 72%/ })).toContainText("Submitted");

    server.items = [e2eRequest("66a1b2c3d4e5f60718293a4b", { status: "quoted", quoteAmount: 99900 })];
    await page.getByRole("button", { name: "Refresh" }).click();

    await expect(page.getByRole("link", { name: /Ecuador 72%/ })).toContainText("Quoted");
    await expect(page.getByRole("link", { name: /Ecuador 72%/ })).toContainText("$999.00");
  });

  test("My quote requests has an empty state with a button to the studio", async ({ page }) => {
    await mockRequestsApi(page, []);
    await withToken(page);
    await openRoute(page, "/en/account/requests");

    await expect(page.getByRole("heading", { name: "You have not sent a quote request yet." })).toBeVisible();
    await page.getByRole("link", { name: "Start in the Studio" }).click();
    await expect(page).toHaveURL(/\/en\/wholesale\/studio$/);
  });

  test("My quote requests shows a problem and lets the person try again", async ({ page }) => {
    const server = await mockRequestsApi(page, [e2eRequest("66a1b2c3d4e5f60718293a4b")]);
    server.status = 500;
    await withToken(page);
    await openRoute(page, "/en/account/requests");
    await expect(page.getByRole("alert")).toContainText("We could not load your quote requests.");

    server.status = 200;
    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page.getByRole("link", { name: /Ecuador 72%/ })).toBeVisible();
  });

  test("My quote requests is for business accounts: a guest signs in first and a retail account is told", async ({ page }) => {
    await mockRequestsApi(page, []);
    await openRoute(page, "/en/account/requests", { account: null });
    await expect(page).toHaveURL(/\/en\/account\/login\?next=%2Faccount%2Frequests$/);

    await openRoute(page, "/en/account/requests", { account: "retail" });
    await expect(page.getByRole("heading", { level: 1, name: "Quote requests are for business accounts" })).toBeVisible();
  });

  test("the account page links to My quote requests for a business account", async ({ page }) => {
    await mockRequestsApi(page, []);
    await withToken(page);
    await openRoute(page, "/en/profile", { account: "business" });

    await page.getByRole("region", { name: "Wholesale" }).getByRole("link", { name: /My quote requests/ }).click();

    await expect(page).toHaveURL(/\/en\/account\/requests$/);
    await expect(page.getByRole("heading", { level: 1, name: "My quote requests" })).toBeVisible();
  });

  test("after a request is sent, the studio links to it in My quote requests", async ({ page }) => {
    await mockQuoteApi(page);
    await mockRequestsApi(page, [e2eRequest("66a1b2c3d4e5f60718293a4b")]);
    await withToken(page);
    await openRoute(page, "/en/wholesale/studio");
    await fillStudio(page);
    await page.getByRole("button", { name: "Submit for quote" }).click();

    await page.getByRole("link", { name: "My quote requests" }).click();

    await expect(page).toHaveURL(/\/en\/account\/requests\?request=66a1b2c3d4e5f60718293a4b$/);
    await expect(page.getByRole("heading", { name: "Request SC-18293A4B" })).toBeVisible();
  });

  test("a refresh keeps the answers of the studio form, except the files", async ({ page }) => {
    // a refresh with an unsent form may ask the browser to confirm, and the person says yes
    page.on("dialog", (dialog) => dialog.accept());
    await openRoute(page, "/en/wholesale/studio");
    await chooseOption(page, /Ecuador 72%/);
    await page.getByRole("button", { name: "Continue" }).click();
    await chooseOption(page, /Rigid gift box/);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.locator("input[type=file]").setInputFiles({ name: "logo.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
    await expect(page.getByRole("button", { name: "Remove logo.pdf" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel(/Company name/).fill("Hacienda Brands");
    await page.getByLabel(/Estimated units/).fill("800");

    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Review & submit" })).toBeVisible();
    await expect(page.getByLabel(/Company name/)).toHaveValue("Hacienda Brands");
    await expect(page.getByLabel(/Estimated units/)).toHaveValue("800");
    await expect(page.getByText("Ecuador 72%")).toBeVisible();
    await expect(page.getByText(/were not kept when the page was reloaded: logo\.pdf/)).toBeVisible();
  });

  test("the browser asks before the tab is closed with an unsent form", async ({ page }) => {
    await openRoute(page, "/en/wholesale/studio");
    await chooseOption(page, /Ecuador 72%/);
    // closing with runBeforeUnload does not wait for the tab, so the question is waited for here
    const question = page.waitForEvent("dialog");

    await page.close({ runBeforeUnload: true });

    const dialog = await question;
    expect(dialog.type()).toBe("beforeunload");
    // the person answers that they want to stay
    await dialog.dismiss();
    expect(page.isClosed()).toBe(false);
  });

  test("the browser does not ask before the tab is closed with an empty form", async ({ page }) => {
    await openRoute(page, "/en/wholesale/studio");
    const asked: string[] = [];
    page.on("dialog", async (dialog) => {
      asked.push(dialog.type());
      await dialog.dismiss();
    });
    const closed = page.waitForEvent("close");

    await page.close({ runBeforeUnload: true });

    await closed;
    expect(asked).toEqual([]);
  });

  test("a guest is sent to sign in and comes back to the studio as a business account", async ({ page }) => {
    await openRoute(page, "/en/wholesale", { account: null });
    await page.getByRole("main").getByRole("link", { name: "Enter the Corporate Cacao Studio" }).first().click();

    await expect(page).toHaveURL(/\/en\/account\/login\?next=%2Fwholesale%2Fstudio$/);
    const main = page.getByRole("main");
    await chooseOption(page, "Business account");
    await main.getByLabel(/Email/).fill("isabel@hacienda.example");
    await main.getByLabel(/Password/).fill("a long password");
    await main.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/en\/wholesale\/studio$/);
    await expect(page.getByRole("heading", { level: 1, name: "The Corporate Cacao Studio" })).toBeVisible();
  });

  test("a retail account sees the message and can start a business account", async ({ page }) => {
    await openRoute(page, "/en/wholesale/studio", { account: "retail" });

    await expect(page.getByRole("heading", { level: 1, name: "The studio is for business accounts" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toHaveCount(0);

    await page.getByRole("link", { name: "Create a business account" }).click();
    await expect(page).toHaveURL(/\/en\/account\/register\?type=business$/);
    await expect(page.getByRole("main").getByRole("radio", { name: "Business account" })).toBeChecked();
    await expect(page.getByRole("main").getByLabel(/Company/)).toBeVisible();
  });

  test("the wholesale page is open to a guest and all its studio buttons lead to the studio address", async ({ page }) => {
    await openRoute(page, "/es/wholesale", { account: null });
    const main = page.getByRole("main");

    await expect(main).toBeVisible();
    for (const name of ["Entrar al Estudio de Cacao Corporativo", "Empezar en el Estudio"]) {
      for (const link of await main.getByRole("link", { name }).all()) {
        await expect(link).toHaveAttribute("href", "/es/wholesale/studio");
      }
    }
    await main.getByRole("link", { name: "Empezar en el Estudio" }).click();
    await expect(page).toHaveURL(/\/es\/account\/login\?next=%2Fwholesale%2Fstudio$/);
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

  test("the home showcase shows the five featured products from the API", async ({ page }) => {
    await mockFeaturedProducts(page);
    await openRoute(page, "/en");

    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(5);
    await expect(cards.first().getByRole("heading", { name: "Ecuador 72%" })).toBeVisible();
    await expect(page.getByRole("link", { name: /See a Batch Passport/ })).toHaveAttribute("href", "/en/shop/ecuador-72");

    await cards.nth(1).getByRole("link", { name: "Peru 68%" }).click();
    await expect(page).toHaveURL(/\/en\/shop\/peru-68$/);
  });

  test("the home showcase shows placeholders while it loads", async ({ page }) => {
    await mockFeaturedProducts(page, { delayMs: 1500 });
    await page.goto("/en", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Loading the seasonal showcase")).toBeAttached();
    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(page.getByRole("article")).toHaveCount(5, { timeout: 10000 });
    await expect(page.getByText("Loading the seasonal showcase")).toHaveCount(0);
  });

  for (const how of ["error", "offline"] as const) {
    test(`the home page works and hides the showcase when the API is down (${how})`, async ({ page }) => {
      await failFeaturedProducts(page, how);
      const crashes: string[] = [];
      page.on("pageerror", (error) => crashes.push(error.message));

      await openRoute(page, "/en");
      await expect(page.getByRole("heading", { name: "Custom chocolate for your brand, produced at scale without compromise." })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Seasonal showcase" })).toHaveCount(0);
      await expect(page.getByRole("article")).toHaveCount(0);
      await expect(page.getByRole("link", { name: /See a Batch Passport/ })).toHaveAttribute("href", "/en/shop");
      expect(crashes).toEqual([]);
    });
  }

  test("an unknown address shows the not found page", async ({ page }) => {
    await page.goto("/en/nothing-here");

    await expect(page.getByRole("heading", { level: 1, name: /couldn't find that page/i })).toBeVisible();
  });
});
