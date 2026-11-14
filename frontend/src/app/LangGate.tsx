// Lets /en and /es through and shows the 404 page for any other first part of the address.
import { Outlet, useParams } from "react-router";
import NotFoundPage from "../features/shell/NotFoundPage";
import { isLang } from "../i18n";

export default function LangGate() {
  const { lang } = useParams();
  return isLang(lang) ? <Outlet /> : <NotFoundPage />;
}
