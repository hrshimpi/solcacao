// The site header: logo, main navigation, language toggle and the search, account and cart buttons.
// Below the lg breakpoint the links move into a menu dialog.
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useLang } from "../../i18n/LanguageContext";
import Drawer from "../../ui/Drawer";
import { BagIcon, MenuIcon, SearchIcon, UserIcon } from "../../ui/Icons";
import LocaleLink from "../../ui/LocaleLink";
import { useCart } from "../cart/CartContext";
import LanguageToggle from "./LanguageToggle";

interface NavProps {
  onSearchOpen: () => void;
}

const links = [
  { key: "nav.shop", to: "/shop" },
  { key: "nav.wholesale", to: "/wholesale" },
  { key: "nav.origins", to: "/#origins" },
  { key: "nav.sampler", to: "/sampler" },
  { key: "nav.contact", to: "/contact" },
] as const;

const menuLinks = [
  ...links,
  { key: "nav.profile", to: "/profile" },
  { key: "nav.signIn", to: "/account/login" },
] as const;

const iconButton = "flex h-11 w-11 items-center justify-center text-ink-cacao hover:text-pod-wine";

export default function Nav({ onSearchOpen }: NavProps) {
  const { t, path } = useLang();
  const { count, open: openCart } = useCart();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const cartLabel = count > 0 ? t("cart.openLabel", { count }) : t("cart.openLabelEmpty");

  function isCurrent(to: string) {
    return !to.includes("#") && pathname === path(to);
  }

  function isInSection(to: string) {
    return !to.includes("#") && pathname.startsWith(path(to));
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-ink-cacao bg-stone-paper">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <LocaleLink to="/" className="font-spectral text-xl font-semibold tracking-tight text-ink-cacao">
          {t("common.brand")}
        </LocaleLink>

        <nav aria-label={t("nav.mainLabel")} className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {links.map((link) => (
              <li key={link.to}>
                <LocaleLink
                  to={link.to}
                  aria-current={isCurrent(link.to) ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center pb-0.5 font-sans text-sm text-ink-cacao hover:text-pod-wine ${
                    isInSection(link.to) ? "underline decoration-1 underline-offset-8" : ""
                  }`}
                >
                  {t(link.key)}
                </LocaleLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center">
          <div className="hidden lg:block">
            <LanguageToggle />
          </div>
          <button type="button" onClick={onSearchOpen} aria-label={t("nav.search")} aria-haspopup="dialog" className={iconButton}>
            <SearchIcon size={18} />
          </button>
          <Link to={path("/profile")} aria-label={t("nav.account")} className={iconButton}>
            <UserIcon size={18} />
          </Link>
          <button type="button" onClick={openCart} aria-label={cartLabel} aria-haspopup="dialog" className={`${iconButton} relative`}>
            <BagIcon size={18} />
            {count > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-0.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sun-gold px-1 font-sans text-[10px] font-semibold leading-none text-ink-cacao"
              >
                {count}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t("nav.menu")}
            aria-haspopup="dialog"
            className={`${iconButton} lg:hidden`}
          >
            <MenuIcon size={20} />
          </button>
        </div>
      </div>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title={t("nav.menu")}>
        <nav aria-label={t("nav.menuLabel")} className="flex-1 px-6 py-6">
          <ul className="flex flex-col gap-1">
            {menuLinks.map((link) => (
              <li key={link.to}>
                <LocaleLink
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-11 items-center font-spectral text-2xl hover:text-sun-gold"
                >
                  {t(link.key)}
                </LocaleLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-paper-text/20 px-6 py-4">
          <LanguageToggle />
        </div>
      </Drawer>
    </header>
  );
}
