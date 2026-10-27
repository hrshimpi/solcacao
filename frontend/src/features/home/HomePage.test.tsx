import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { apiProduct, featuredEnglish, featuredSpanish, mockFeatured, mockFeaturedFailure, mockFeaturedPending } from "../../test/mockApi";
import { renderAt } from "../../test/renderAt";

const showcaseTitle = "Seasonal showcase";

async function openHome(path = "/en") {
  const view = renderAt(path);
  await screen.findByRole("heading", { level: 1 });
  return view;
}

function showcase() {
  return screen.queryByRole("region", { name: showcaseTitle });
}

function passportLink() {
  return screen.getByRole("link", { name: /See a Batch Passport/ });
}

describe("home page showcase: the five featured products", () => {
  it("asks the API for five featured products in the current language", async () => {
    const fetchMock = mockFeatured();
    await openHome();

    await screen.findAllByRole("article");

    const featuredCalls = fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/products"));
    expect(featuredCalls).toHaveLength(1);
    const [url, init] = featuredCalls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/products?featured=true&limit=5");
    expect(new Headers(init.headers).get("Accept-Language")).toBe("en");
  });

  it("shows five items, with the name, the flavor line and the price from the API", async () => {
    mockFeatured();
    await openHome();

    const cards = await screen.findAllByRole("article");

    expect(cards).toHaveLength(5);
    expect(within(showcase()!).getAllByRole("listitem")).toHaveLength(5);
    expect(within(cards[0]).getByRole("heading", { level: 3, name: "Ecuador 72%" })).toBeInTheDocument();
    expect(within(cards[0]).getByText("flavor of Ecuador 72%")).toBeInTheDocument();
    expect(within(cards[0]).getByText("$12.00")).toBeInTheDocument();
    expect(within(cards[4]).getByRole("heading", { name: "Madagascar 80%" })).toBeInTheDocument();
    expect(within(cards[4]).getByText("$14.00")).toBeInTheDocument();
  });

  it("shows only five even when the API sends more", async () => {
    mockFeatured({ en: [...featuredEnglish, apiProduct("extra-bar", "Extra Bar"), apiProduct("another-bar", "Another Bar")] });
    await openHome();

    expect(await screen.findAllByRole("article")).toHaveLength(5);
    expect(screen.queryByText("Extra Bar")).not.toBeInTheDocument();
  });

  it("shows what it has when there are fewer than five", async () => {
    mockFeatured({ en: featuredEnglish.slice(0, 3) });
    await openHome();

    expect(await screen.findAllByRole("article")).toHaveLength(3);
  });

  it("loads the pictures lazily, with their size set", async () => {
    mockFeatured();
    await openHome();

    const cards = await screen.findAllByRole("article");

    for (const card of cards) {
      const image = card.querySelector("img")!;
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("width", "480");
      expect(image).toHaveAttribute("height", "600");
    }
  });
});

describe("home page showcase: links", () => {
  it("each card opens its product page", async () => {
    mockFeatured();
    await openHome();

    const cards = await screen.findAllByRole("article");

    const hrefs = cards.map((card) => within(card).getByRole("link").getAttribute("href"));
    expect(hrefs).toEqual(["/en/shop/ecuador-72", "/en/shop/peru-68", "/en/shop/venezuela-76", "/en/shop/colombia-64", "/en/shop/madagascar-80"]);
  });

  it("View all origins goes to the shop", async () => {
    mockFeatured();
    await openHome();

    await screen.findAllByRole("article");

    expect(within(showcase()!).getByRole("link", { name: /View all origins/ })).toHaveAttribute("href", "/en/shop");
  });

  it("Shop the Collection goes to the shop, and both wholesale buttons go to wholesale", async () => {
    mockFeatured();
    await openHome();
    await screen.findAllByRole("article");

    const main = within(screen.getByRole("main"));
    expect(main.getByRole("link", { name: "Shop the Collection" })).toHaveAttribute("href", "/en/shop");
    const wholesale = main.getAllByRole("link", { name: "Explore Wholesale" });
    expect(wholesale).toHaveLength(2);
    for (const link of wholesale) expect(link).toHaveAttribute("href", "/en/wholesale");
  });

  it("See a Batch Passport opens the first featured product, whichever it is", async () => {
    mockFeatured({ en: [apiProduct("peru-68", "Peru 68%"), ...featuredEnglish.slice(2)] });
    await openHome();

    await screen.findAllByRole("article");

    expect(passportLink()).toHaveAttribute("href", "/en/shop/peru-68");
  });

  it("clicking a card goes to the product page", async () => {
    const user = userEvent.setup();
    mockFeatured();
    const { router } = await openHome();

    const cards = await screen.findAllByRole("article");
    await user.click(within(cards[1]).getByRole("link", { name: "Peru 68%" }));

    expect(router.state.location.pathname).toBe("/en/shop/peru-68");
  });
});

describe("home page showcase: while it loads", () => {
  it("shows placeholders and says it is loading, then swaps them for the products", async () => {
    const { answer } = mockFeaturedPending();
    await openHome();

    expect(showcase()).toBeInTheDocument();
    expect(screen.getByText("Loading the seasonal showcase")).toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(showcase()!.querySelectorAll("li.animate-pulse")).toHaveLength(5);

    answer(featuredEnglish);

    expect(await screen.findAllByRole("article")).toHaveLength(5);
    expect(screen.queryByText("Loading the seasonal showcase")).not.toBeInTheDocument();
    expect(showcase()!.querySelectorAll("li.animate-pulse")).toHaveLength(0);
  });

  it("keeps the rest of the page visible and sends the passport link to the shop", async () => {
    mockFeaturedPending();
    await openHome();

    expect(screen.getByRole("heading", { level: 1, name: /Grown in Sunlight/ })).toBeInTheDocument();
    expect(passportLink()).toHaveAttribute("href", "/en/shop");
  });
});

describe("home page showcase: when the API fails", () => {
  it.each(["server-error", "network", "not-json", "wrong-shape"] as const)("hides the section quietly after a %s failure", async (failure) => {
    const fetchMock = mockFeaturedFailure(failure);
    const problems = vi.spyOn(console, "error").mockImplementation(() => {});
    await openHome();

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/products"))).toBe(true));
    await waitFor(() => expect(screen.queryByText("Loading the seasonal showcase")).not.toBeInTheDocument());

    expect(showcase()).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: showcaseTitle })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    // nothing was reported as an error and nothing shows an error message
    expect(problems).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hides the section when the API has no featured products", async () => {
    mockFeatured({ en: [] });
    await openHome();

    await waitFor(() => expect(screen.queryByText("Loading the seasonal showcase")).not.toBeInTheDocument());

    expect(showcase()).not.toBeInTheDocument();
  });

  it("hides the section when every product in the answer is broken", async () => {
    mockFeatured({ en: [null, {}, { slug: "no-name" }] });
    await openHome();

    await waitFor(() => expect(screen.queryByText("Loading the seasonal showcase")).not.toBeInTheDocument());

    expect(showcase()).not.toBeInTheDocument();
  });

  it("still shows every other part of the page, and the links still work", async () => {
    mockFeaturedFailure("server-error");
    await openHome();
    await waitFor(() => expect(screen.queryByText("Loading the seasonal showcase")).not.toBeInTheDocument());

    expect(screen.getByRole("heading", { level: 1, name: /Grown in Sunlight/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /The cacao pod is a field document/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Where our chocolate comes from" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Custom chocolate for your brand/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop the Collection" })).toHaveAttribute("href", "/en/shop");
    expect(passportLink()).toHaveAttribute("href", "/en/shop");
  });
});

describe("home page showcase: in Spanish", () => {
  it("asks for Spanish and shows the names and flavor lines the API sends", async () => {
    const fetchMock = mockFeatured();
    await openHome("/es");

    const cards = await screen.findAllByRole("article");

    const [, init] = fetchMock.mock.calls.find(([url]) => String(url).startsWith("/api/products")) as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("Accept-Language")).toBe("es");
    expect(within(cards[1]).getByRole("heading", { name: "Perú 68%" })).toBeInTheDocument();
    expect(within(cards[1]).getByText("sabor de Peru 68%")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Selección de temporada" })).toBeInTheDocument();
    expect(within(cards[0]).getByRole("link")).toHaveAttribute("href", "/es/shop/ecuador-72");
    expect(screen.getByRole("link", { name: /Ver un Pasaporte de lote/ })).toHaveAttribute("href", "/es/shop/ecuador-72");
  });

  it("formats the price for the language", async () => {
    mockFeatured();
    await openHome("/es");

    const [first] = await screen.findAllByRole("article");

    expect(within(first).getByText("$12.00")).toBeInTheDocument();
  });

  it("loads the products again in the new language when you switch", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFeatured();
    await openHome("/en");
    const english = await screen.findAllByRole("article");
    expect(within(english[1]).getByRole("heading", { name: "Peru 68%" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ES, Español" }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Perú 68%" })).toBeInTheDocument());
    const languages = fetchMock.mock.calls
      .filter(([url]) => String(url).startsWith("/api/products"))
      .map(([, init]) => new Headers((init as RequestInit).headers).get("Accept-Language"));
    expect(languages).toEqual(["en", "es"]);
    expect(featuredSpanish).toHaveLength(5);
  });

  it("does not show an old answer after the language changed", async () => {
    const user = userEvent.setup();
    const { answer } = mockFeaturedPending();
    await openHome("/en");

    await user.click(screen.getByRole("button", { name: "ES, Español" }));
    answer(featuredSpanish);

    expect(await screen.findByRole("heading", { name: "Perú 68%" })).toBeInTheDocument();
  });
});

describe("home page: pictures", () => {
  it("the hero picture loads first, in three sizes", async () => {
    mockFeaturedPending();
    await openHome();

    const hero = screen.getByRole("main").querySelector("section img")!;

    expect(hero).toHaveAttribute("loading", "eager");
    expect(hero).toHaveAttribute("fetchpriority", "high");
    expect(hero).toHaveAttribute("width", "1600");
    expect(hero).toHaveAttribute("height", "900");
    expect(hero).toHaveAttribute("sizes", "100vw");
    expect(hero.getAttribute("srcset")!.split(", ").map((part) => part.split(" ")[1])).toEqual(["800w", "1200w", "1600w"]);
  });

  it("every other picture is lazy and has its size set", async () => {
    mockFeatured();
    await openHome();
    await screen.findAllByRole("article");

    const images = [...screen.getByRole("main").querySelectorAll("img")];
    const [hero, ...others] = images;

    expect(hero).toHaveAttribute("fetchpriority", "high");
    expect(others.length).toBeGreaterThanOrEqual(6);
    for (const image of others) {
      expect(image, image.outerHTML).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("width");
      expect(image).toHaveAttribute("height");
      expect(image).not.toHaveAttribute("fetchpriority");
    }
  });
});

describe("home page: accessibility", () => {
  it("has no axe problems while loading, when loaded and when hidden", async () => {
    const { answer } = mockFeaturedPending();
    const { container } = await openHome();
    const noContrast = { rules: { "color-contrast": { enabled: false } } };

    expect((await axe(container, noContrast)).violations).toEqual([]);

    answer(featuredEnglish);
    await screen.findAllByRole("article");
    expect((await axe(container, noContrast)).violations).toEqual([]);
  });

  it("has no axe problems when the showcase is hidden", async () => {
    mockFeaturedFailure("server-error");
    const { container } = await openHome();
    await waitFor(() => expect(screen.queryByText("Loading the seasonal showcase")).not.toBeInTheDocument());

    expect((await axe(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  it("keeps the heading order: one h1, h2 for the sections, h3 for the products", async () => {
    mockFeatured();
    await openHome();
    await screen.findAllByRole("article");

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const cardHeadings = within(showcase()!).getAllByRole("heading", { level: 3 });
    expect(cardHeadings).toHaveLength(5);
  });
});
