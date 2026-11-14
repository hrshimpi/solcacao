import { act, fireEvent } from "@testing-library/react";
import { matchRoutes } from "react-router";
import { getProducts } from "../data/products";
import type { AccountType } from "../features/auth/components/AuthShell";
import { renderAt } from "../test/renderAt";
import { routes } from "./routes";

const products = getProducts("en");

// the studio is only for business accounts, so it is opened as one, and again as a retail account to check its message
const pages: [path: string, account?: AccountType][] = [
  ["/en"],
  ["/es"],
  ["/en/shop"],
  [`/en/shop/${products[0].slug}`],
  ["/en/wholesale"],
  ["/es/wholesale"],
  ["/en/wholesale/studio", "business"],
  ["/en/wholesale/studio", "retail"],
  ["/es/wholesale/studio", "retail"],
  ["/en/sampler"],
  ["/en/contact"],
  ["/en/account/login"],
  ["/en/account/register"],
  ["/en/profile"],
];

const cases = pages.map(([path, account]) => [account ? `${path} (${account} account)` : path, path, account] as const);

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
  it.each(cases)("every link on %s points to a real page", (_name, path, account) => {
    const { container } = renderAt(path, { account });

    const hrefs = Array.from(container.querySelectorAll("a[href]"))
      .map((link) => link.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("/"));

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(isRealPage(href.split(/[?#]/)[0]), `${path} links to ${href}`).toBe(true);
    }
  });

  it.each(cases)("no button on %s sends you to a missing page", async (_name, path, account) => {
    const first = renderAt(path, { account });
    const total = first.container.querySelectorAll("button").length;
    first.unmount();

    for (let i = 0; i < total; i++) {
      const { router, container, unmount } = renderAt(path, { account });

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
