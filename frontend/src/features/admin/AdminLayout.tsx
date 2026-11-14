// The frame of the dashboard: a heading and the sections as links under it, with the page of the section below. The look is
// the one of the account pages (the same header band, the same palette), so the dashboard is part of the shop and not another site.
import { Outlet, useLocation } from "react-router";
import { useLang } from "../../i18n/LanguageContext";
import { usePageTitle } from "../../lib/usePageTitle";
import LocaleLink from "../../ui/LocaleLink";

const sections = [
  { to: "/admin", key: "admin.nav.overview" },
  { to: "/admin/orders", key: "admin.nav.orders" },
  { to: "/admin/products", key: "admin.nav.products" },
  { to: "/admin/inquiries", key: "admin.nav.inquiries" },
] as const;

export default function AdminLayout() {
  const { t, path } = useLang();
  const { pathname } = useLocation();
  usePageTitle(t("titles.admin"));

  // the overview is only the address itself, the others also cover the pages inside them (an order, a new product)
  const isCurrent = (to: string) => (to === "/admin" ? pathname === path(to) : pathname.startsWith(path(to)));

  return (
    <div className="bg-stone-paper">
      <div className="border-b border-ink-cacao">
        <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 md:pt-14">
          <p className="mb-3 font-sans text-[11px] uppercase tracking-[0.18em] text-pod-wine">{t("admin.eyebrow")}</p>
          <h1 className="font-spectral text-4xl font-semibold tracking-tight text-ink-cacao md:text-5xl">{t("admin.title")}</h1>
          <nav aria-label={t("admin.navLabel")} className="-mb-px mt-8">
            <ul className="flex flex-wrap gap-x-8">
              {sections.map((section) => (
                <li key={section.to}>
                  <LocaleLink
                    to={section.to}
                    aria-current={isCurrent(section.to) ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center border-b-2 pb-1 font-sans text-sm text-ink-cacao hover:text-pod-wine ${isCurrent(section.to) ? "border-ink-cacao font-medium" : "border-transparent"}`}
                  >
                    {t(section.key)}
                  </LocaleLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        <Outlet />
      </div>
    </div>
  );
}
