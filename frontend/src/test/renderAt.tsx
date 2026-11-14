// Test helpers: render the whole app at an address, the same way the browser would, with somebody signed in or nobody.
// renderPiece renders one component with the language and the screen reader messages around it, for small tests.
// The app starts without asking a server who is signed in (see InitialAuthContext), so these tests need no network.
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "../app/routes";
import { InitialAuthContext, toAuthUser, type AuthUser, type InitialAuth } from "../features/auth/AuthContext";
import type { AccountType } from "../features/auth/components/AuthShell";
import { LanguageProvider } from "../i18n/LanguageContext";
import { setAuthToken } from "../lib/authToken";
import { AnnounceProvider } from "../ui/LiveRegion";
import type { FakeAccount, FakeServer } from "./fakeServer";

// a signed in user. The name is empty unless a test gives one, so the forms start empty as they would for an account
// whose names the page does not know.
export function testUser(accountType: AccountType, email = "isabel@example.com", names: { name?: string; companyName?: string } = {}): AuthUser {
  return {
    id: "64b7f0c2a1b2c3d4e5f60718",
    email,
    name: names.name ?? "",
    role: "user",
    accountType,
    preferredLanguage: "en",
    marketingEmails: false,
    createdAt: "2026-06-15T12:00:00.000Z",
    ...(names.companyName ? { companyName: names.companyName } : {}),
  };
}

// Signs an account of the fake server in, the way a page that was opened by a signed in person would have it: the server
// knows the token, the page has the token in memory, and the user is what the page would have been given.
export function sessionFor(server: FakeServer, account: FakeAccount): AuthUser {
  server.tokenOf = account;
  server.cookieOf = account;
  setAuthToken("token-0");
  return toAuthUser(server.serverUser(account), account.accountType === "b2b" ? { companyName: account.companyName, verificationStatus: account.verificationStatus } : {});
}

interface RenderOptions {
  account?: AccountType;
  email?: string;
  names?: { name?: string; companyName?: string };
  // a user of your own, for what the helper above cannot say
  user?: AuthUser;
}

export function renderAt(path: string, options: RenderOptions = {}) {
  const initial: InitialAuth = options.user
    ? { status: "authed", user: options.user }
    : options.account
      ? { status: "authed", user: testUser(options.account, options.email, options.names) }
      : { status: "guest" };

  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return {
    router,
    ...render(
      <InitialAuthContext.Provider value={initial}>
        <RouterProvider router={router} />
      </InitialAuthContext.Provider>,
    ),
  };
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
