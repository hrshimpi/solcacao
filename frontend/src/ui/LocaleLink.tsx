// A router link that adds the current language (/en or /es) in front of the path.
import { Link, type LinkProps } from "react-router";
import { useLang } from "../i18n/LanguageContext";

export default function LocaleLink({ to, ...rest }: Omit<LinkProps, "to"> & { to: string }) {
  const { path } = useLang();
  return <Link to={path(to)} {...rest} />;
}
