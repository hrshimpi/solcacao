// Test helpers: render the whole app at an address, the same way the browser would, and sign someone in first.
// renderPiece renders one component with the language and the screen reader messages around it, for small tests.
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "../app/routes";
import { AUTH_STORAGE_KEY } from "../features/auth/AuthContext";
import type { AccountType } from "../features/auth/components/AuthShell";
import { LanguageProvider } from "../i18n/LanguageContext";
import { AnnounceProvider } from "../ui/LiveRegion";

// puts a signed in user in the browser tab before the app starts (the tests clear it again after each test)
export function signInAs(accountType: AccountType, email = "isabel@example.com") {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ email, accountType }));
}

export function renderAt(path: string, options: { account?: AccountType } = {}) {
  if (options.account) signInAs(options.account);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return { router, ...render(<RouterProvider router={router} />) };
}

export function renderPiece(piece: ReactElement, path = "/en/wholesale/studio") {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <LanguageProvider>
            <AnnounceProvider>{piece}</AnnounceProvider>
          </LanguageProvider>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}
