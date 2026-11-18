// Keeps the pages of an account from people who are not signed in:
//   the answer is not there yet  -> a loading message (a signed in person must not be sent away because of a slow answer)
//   nobody signed in             -> the sign in page, which brings them back here afterwards
//   somebody signed in           -> the page
// The server checks who is calling again for everything that matters, so this only decides what the pages show.
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useLang } from "../../../i18n/LanguageContext";
import PageLoading from "../../../ui/PageLoading";
import { useAuth } from "../AuthContext";
import { loginWithNext, withoutLanguage } from "../nextPath";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const { path } = useLang();
  const { pathname, search } = useLocation();

  if (status === "loading") return <PageLoading />;
  if (!user) {
    // replace, so the Back button does not return to a page that sends you away again
    return <Navigate to={path(loginWithNext(withoutLanguage(pathname) + search))} replace />;
  }
  return <>{children}</>;
}
