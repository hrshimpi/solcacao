// The site footer: four columns of links, the newsletter form and the copyright line.
import { useState } from "react";
import { useLang } from "../../i18n/LanguageContext";
import { useForm } from "../../lib/useForm";
import { email, required } from "../../lib/validation";
import LocaleLink from "../../ui/LocaleLink";
import { useAnnounce } from "../../ui/LiveRegion";
import TextField from "../../ui/TextField";

const whatsappNumber = "15551234567";

const columns = [
  {
    title: "footer.shop",
    links: [
      { key: "footer.allBars", to: "/shop?category=bar" },
      { key: "footer.truffles", to: "/shop?category=truffle" },
      { key: "footer.seasonal", to: "/shop?category=seasonal" },
      { key: "footer.samplers", to: "/sampler" },
      { key: "footer.origins", to: "/#origins" },
    ],
  },
  {
    title: "footer.wholesale",
    links: [
      { key: "footer.wholesaleOverview", to: "/wholesale" },
      { key: "footer.requestQuote", to: "/wholesale/studio" },
    ],
  },
  {
    title: "footer.company",
    links: [
      { key: "footer.story", to: "/info/story" },
      { key: "footer.sustainability", to: "/info/sustainability" },
      { key: "footer.partners", to: "/info/partners" },
      { key: "footer.press", to: "/info/press" },
      { key: "footer.careers", to: "/info/careers" },
    ],
  },
  {
    title: "footer.account",
    links: [
      { key: "footer.signIn", to: "/account/login" },
      { key: "footer.createAccount", to: "/account/register" },
      { key: "footer.profile", to: "/profile" },
    ],
  },
] as const;

const linkClass =
  "inline-flex min-h-6 items-center py-1 font-spectral text-sm text-paper-text/70 hover:text-paper-text";

export default function Footer() {
  const { t } = useLang();
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(t("footer.whatsappMessage"))}`;
  const announce = useAnnounce();
  const [subscribed, setSubscribed] = useState(false);

  const form = useForm({
    initial: { email: "" },
    rules: { email: [required, email] },
    onSubmit: () => {
      setSubscribed(true);
      announce(t("footer.subscribed"));
      form.reset();
    },
  });

  return (
    <footer className="on-dark bg-ink-cacao text-paper-text">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6">
        <nav aria-label={t("footer.navLabel")} className="mb-14 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="mb-4 font-sans text-xs font-medium uppercase tracking-widest text-paper-text/70">
                {t(column.title)}
              </h2>
              <ul className="flex flex-col">
                {column.links.map((link) => (
                  <li key={link.key}>
                    <LocaleLink to={link.to} className={linkClass}>
                      {t(link.key)}
                    </LocaleLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h2 className="mb-4 font-sans text-xs font-medium uppercase tracking-widest text-paper-text/70">
              {t("footer.support")}
            </h2>
            <ul className="flex flex-col">
              <li>
                <LocaleLink to="/info/faq" className={linkClass}>
                  {t("footer.faq")}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink to="/info/shipping" className={linkClass}>
                  {t("footer.shipping")}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink to="/info/returns" className={linkClass}>
                  {t("footer.returns")}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink to="/info/privacy" className={linkClass}>
                  {t("footer.privacy")}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink to="/info/terms" className={linkClass}>
                  {t("footer.terms")}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink to="/contact" className={linkClass}>
                  {t("footer.contact")}
                </LocaleLink>
              </li>
              <li>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {t("footer.whatsapp")}
                  <span className="sr-only"> {t("footer.opensNewTab")}</span>
                </a>
              </li>
            </ul>
          </div>
        </nav>

        <div className="grid items-start gap-8 border-t border-paper-text/20 pt-10 md:grid-cols-2">
          <div>
            <p className="mb-2 font-spectral text-2xl">{t("common.brand")}</p>
            <p className="max-w-xs font-sans text-xs leading-relaxed text-paper-text/70">{t("footer.about")}</p>
          </div>

          <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="md:justify-self-end md:w-full md:max-w-sm">
            <h2 className="mb-3 font-sans text-xs font-medium uppercase tracking-widest text-paper-text/70">
              {t("footer.newsletter")}
            </h2>
            <TextField
              tone="dark"
              label={t("footer.emailLabel")}
              type="email"
              autoComplete="email"
              required
              placeholder={t("footer.emailPlaceholder")}
              hint={t("footer.newsletterHint")}
              {...form.field("email")}
            />
            <button
              type="submit"
              className="mt-4 min-h-11 w-full bg-sun-gold px-5 py-2.5 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90 sm:w-auto"
            >
              {t("footer.subscribe")}
            </button>
            {subscribed && <p className="mt-3 font-sans text-sm text-paper-text">{t("footer.subscribed")}</p>}
          </form>
        </div>

        <div className="mt-10 border-t border-paper-text/20 pt-6">
          <p className="font-sans text-xs text-paper-text/70">
            {t("footer.copyright", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
}
