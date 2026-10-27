import { act, fireEvent } from "@testing-library/react";
import { matchRoutes } from "react-router";
import { getProducts } from "../data/products";
import { renderAt } from "../test/renderAt";
import { routes } from "./routes";

const products = getProducts("en");

const pages = [
  "/en",
  "/es",
  "/en/shop",
  `/en/shop/${products[0].slug}`,
  "/en/wholesale",
  "/en/wholesale/studio",
  "/en/sampler",
  "/en/contact",
  "/en/account/login",
  "/en/account/register",
  "/en/profile",
];

// a link is fine when it matches a page route (not the 404 route), starts with /en or /es and names a real product
function isRealPage(pathname: string) {
  const matches = matchRoutes(routes, pathname);
  if (!matches) return false;

  const last = matches[matches.length - 1];
  if (last.route.path === "*") return false;
  if (last.params.lang !== "en" && last.params.lang !== "es") return false;

  const slug = last.params.slug;
  return !slug || products.some((product) => product.slug === slug);
}

describe("links", () => {
  it.each(pages)("every link on %s points to a real page", (path) => {
    const { container } = renderAt(path);

    const hrefs = Array.from(container.querySelectorAll("a[href]"))
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("/"));

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(isRealPage(href.split(/[?#]/)[0]), `${path} links to ${href}`).toBe(true);
    }
  });

  it.each(pages)("no button on %s sends you to a missing page", async (path) => {
    const first = renderAt(path);
    const total = first.container.querySelectorAll("button").length;
    first.unmount();

    for (let i = 0; i < total; i++) {
      const { router, container, unmount } = renderAt(path);

      await act(async () => {
        fireEvent.click(container.querySelectorAll("button")[i]);
      });

      const now = router.state.location.pathname;
      if (now !== path) {
        expect(isRealPage(now), `button ${i} on ${path} went to ${now}`).toBe(true);
      }
      unmount();
    }
  });
});
