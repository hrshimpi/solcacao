// Keeps the wrong people from a page they could not use:
//   nobody signed in         -> the sign in page, which brings them back here afterwards
//   another type of account  -> what is given as `denied` (a short message)
//   the right account type   -> the page
// The server checks the account type again for everything that matters, so this only decides what the pages show.
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useLang } from "../../../i18n/LanguageContext";
import { useAuth } from "../AuthContext";
import { loginWithNext, withoutLanguage } from "../nextPath";
import type { AccountType } from "./AuthShell";

interface RequireAccountTypeProps {
  accountType: AccountType;
  denied: ReactNode;
  children: ReactNode;
}

export default function RequireAccountType({ accountType, denied, children }: RequireAccountTypeProps) {
  const { user } = useAuth();
  const { path } = useLang();
  const { pathname, search } = useLocation();

  if (!user) {
    // replace, so the Back button does not return to a page that sends you away again
    return <Navigate to={path(loginWithNext(withoutLanguage(pathname) + search))} replace />;
  }
  if (user.accountType !== accountType) return <>{denied}</>;
  return <>{children}</>;
}
