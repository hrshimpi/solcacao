// Runs the axe checker on every page, in both languages. Colour contrast cannot be measured in jsdom,
// so that rule is checked in the Playwright tests instead.
import { screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { AccountType } from "../features/auth/components/AuthShell";
import { renderAt } from "../test/renderAt";

// the studio is opened as a business account, and its message for a retail account is checked too
const pages: [path: string, account?: AccountType][] = [
  ["/en"],
  ["/en/shop"],
  ["/en/shop/ecuador-72"],
  ["/en/wholesale"],
  ["/en/wholesale/studio", "business"],
  ["/en/wholesale/studio", "retail"],
  ["/en/sampler"],
  ["/en/contact"],
  ["/en/account/login"],
  ["/en/account/register"],
  ["/en/profile"],
  ["/en/no-such-page"],
  ["/es"],
  ["/es/shop"],
  ["/es/wholesale"],
  ["/es/wholesale/studio", "business"],
  ["/es/wholesale/studio", "retail"],
  ["/es/contact"],
];

const cases = pages.map(([path, account]) => [account ? `${path} (${account} account)` : path, path, account] as const);

describe("axe", () => {
  it.each(cases)("%s has no accessibility violations", async (_name, path, account) => {
    const { container } = renderAt(path, { account });
    await screen.findByRole("heading", { level: 1 });

    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });

    expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(" | ")}`)).toEqual([]);
  });
});
