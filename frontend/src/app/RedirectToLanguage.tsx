// Sends the bare address "/" to /en or /es, using the saved choice or the browser language.
import { Navigate } from "react-router";
import { preferredLanguage } from "../i18n/LanguageContext";

export default function RedirectToLanguage() {
  return <Navigate to={`/${preferredLanguage()}`} replace />;
}
