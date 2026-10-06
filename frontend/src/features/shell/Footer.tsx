import { Page } from "../../types";

interface FooterProps {
  setPage: (p: Page) => void;
}

export default function Footer({ setPage }: FooterProps) {
  const columns = [
    {
      label: "Shop",
      links: ["All bars", "Truffles", "Seasonal", "Gift sets", "Samplers"],
    },
    {
      label: "Wholesale",
      links: ["B2B overview", "Corporate gifting", "White label", "Pricing", "Request a quote"],
    },
    {
      label: "Company",
      links: ["Our story", "Origin partners", "Sustainability", "Press", "Careers"],
    },
    {
      label: "Support",
      links: ["FAQ", "Shipping", "Returns", "Contact us", "WhatsApp"],
    },
  ];

  return (
    <footer className="bg-ink-cacao">
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10 mb-14">
          {columns.map((col, i) => (
            <div key={col.label}>
              <h4 className="font-sans text-xs font-medium text-paper-text/40 uppercase tracking-widest mb-5">
                {col.label}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <button className="font-spectral text-sm text-paper-text/70 hover:text-paper-text transition-colors text-left">
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
              {i < columns.length - 1 && (
                <div className="hidden md:block absolute" />
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-paper-text/10 pt-10 grid md:grid-cols-2 gap-8 items-start">
          <div>
            <p className="font-spectral text-2xl text-paper-text mb-2">SolCacao</p>
            <p className="font-sans text-xs text-paper-text/40 leading-relaxed max-w-xs">
              Single-origin chocolate, sourced direct from farming cooperatives across Latin America and Madagascar.
            </p>
          </div>

          <div className="flex flex-col gap-4 md:items-end">
            <div className="flex items-center gap-3">
              <input
                type="email"
                placeholder="your@email.com"
                className="font-sans text-xs bg-paper-text/5 border border-paper-text/20 text-paper-text placeholder-paper-text/30 px-4 py-2.5 w-52 focus:outline-none focus:border-paper-text/50 transition-colors"
              />
              <button className="font-sans text-xs font-medium bg-sun-gold text-ink-cacao px-5 py-2.5 hover:bg-sun-gold/90 transition-colors whitespace-nowrap">
                Subscribe
              </button>
            </div>
            <p className="font-sans text-[10px] text-paper-text/30">
              Field notes, new harvests, limited releases.
            </p>

            <div className="flex items-center gap-4 mt-2">
              {["Instagram", "Twitter", "LinkedIn"].map((s) => (
                <button key={s} className="font-sans text-[10px] text-paper-text/40 hover:text-paper-text/70 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-paper-text/10 mt-10 pt-6 flex flex-col md:flex-row justify-between gap-3">
          <p className="font-sans text-[10px] text-paper-text/30">
            © 2024 SolCacao · Todos los derechos reservados · All rights reserved
          </p>
          <div className="flex gap-4">
            {["Privacy", "Terms", "Cookies"].map((l) => (
              <button key={l} className="font-sans text-[10px] text-paper-text/30 hover:text-paper-text/50 transition-colors">
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
