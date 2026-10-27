// Runs the axe checker on every page, in both languages. Colour contrast cannot be measured in jsdom,
// so that rule is checked in the Playwright tests instead.
import { screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { renderAt } from "../test/renderAt";

const pages = [
  "/en",
  "/en/shop",
  "/en/shop/ecuador-72",
  "/en/wholesale",
  "/en/wholesale/studio",
  "/en/sampler",
  "/en/contact",
  "/en/account/login",
  "/en/account/register",
  "/en/profile",
  "/en/no-such-page",
  "/es",
  "/es/shop",
  "/es/wholesale/studio",
  "/es/contact",
];

describe("axe", () => {
  it.each(pages)("%s has no accessibility violations", async (path) => {
    const { container } = renderAt(path);
    await screen.findByRole("heading", { level: 1 });

    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });

    expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(" | ")}`)).toEqual([]);
  });
});
