import { act, fireEvent, render } from "@testing-library/react";
import { createMemoryRouter, matchRoutes, RouterProvider } from "react-router";
import { products } from "../data/products";
import { routes } from "./routes";

const pages = [
  "/",
  "/shop",
  `/shop/${products[0].slug}`,
  "/wholesale",
  "/wholesale/studio",
  "/login",
  "/register",
  "/profile",
  "/sampler",
];

function isRealPage(pathname: string) {
  const matches = matchRoutes(routes, pathname);
  if (!matches) return false;

  const last = matches[matches.length - 1];
  if (last.route.path === "*") return false;

  const slug = last.params.slug;
  return !slug || products.some((product) => product.slug === slug);
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return { router, ...render(<RouterProvider router={router} />) };
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
