import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

interface NavProps {
  cartCount: number;
  lang: "EN" | "ES";
  setLang: (l: "EN" | "ES") => void;
  onCartOpen: () => void;
}

export default function Nav({ cartCount, lang, setLang, onCartOpen }: NavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const links = [
    { label: "Shop", to: "/shop", active: pathname === "/shop" },
    { label: "Wholesale", to: "/wholesale", active: pathname === "/wholesale" },
    { label: "Our Origins", to: "/shop/ecuador-72", active: pathname.startsWith("/shop/") },
    { label: "Build a Sampler", to: "/sampler", active: pathname === "/sampler" },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-stone-paper border-b border-ink-cacao">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="font-spectral text-xl font-semibold text-ink-cacao tracking-tight shrink-0"
          >
            SolCacao
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`font-sans text-sm text-ink-cacao hover:text-pod-wine transition-colors pb-0.5 ${l.active ? "border-b border-ink-cacao" : ""}`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1 font-sans text-xs">
              <button
                onClick={() => setLang("EN")}
                className={`px-1 transition-opacity ${lang === "EN" ? "font-semibold" : "opacity-40 hover:opacity-70"}`}
              >
                EN
              </button>
              <span className="opacity-30">/</span>
              <button
                onClick={() => setLang("ES")}
                className={`px-1 transition-opacity ${lang === "ES" ? "font-semibold" : "opacity-40 hover:opacity-70"}`}
              >
                ES
              </button>
            </div>

            <button className="text-ink-cacao hover:text-pod-wine transition-colors">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>

            <button
              onClick={() => navigate("/login")}
              className="hidden md:block text-ink-cacao hover:text-pod-wine transition-colors"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </button>

            <button
              onClick={onCartOpen}
              className="relative text-ink-cacao hover:text-pod-wine transition-colors"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <line x1="3" x2="21" y1="6" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-sun-gold text-ink-cacao text-[9px] font-sans font-semibold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                  {cartCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden text-ink-cacao"
              aria-label="Open menu"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-ink-cacao/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 bg-ink-cacao h-full flex flex-col px-8 py-10 slide-in-right">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 right-6 text-paper-text/60 hover:text-paper-text transition-colors"
              aria-label="Close menu"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <line x1="18" x2="6" y1="6" y2="18" />
                <line x1="6" x2="18" y1="6" y2="18" />
              </svg>
            </button>

            <p className="font-spectral text-paper-text/40 text-sm mb-8">SolCacao</p>

            <div className="flex flex-col gap-5">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  className="font-spectral text-3xl text-paper-text text-left hover:text-sun-gold transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>

            <div className="mt-auto">
              <div className="border-t border-paper-text/10 pt-6 flex gap-3 font-sans text-sm text-paper-text/40">
                <button
                  onClick={() => setLang("EN")}
                  className={
                    lang === "EN" ? "text-paper-text font-medium" : "hover:text-paper-text/60"
                  }
                >
                  English
                </button>
                <span>/</span>
                <button
                  onClick={() => setLang("ES")}
                  className={
                    lang === "ES" ? "text-paper-text font-medium" : "hover:text-paper-text/60"
                  }
                >
                  Español
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
