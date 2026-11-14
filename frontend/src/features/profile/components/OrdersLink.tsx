// The way to the orders from the account page.
import { useLang } from "../../../i18n/LanguageContext";
import { ArrowRightIcon } from "../../../ui/Icons";
import LocaleLink from "../../../ui/LocaleLink";

export default function OrdersLink() {
  const { t } = useLang();

  return (
    <section aria-labelledby="profile-orders" className="mt-14 md:mt-16">
      <div className="border-b border-ink-cacao pb-4">
        <h2 id="profile-orders" className="font-spectral text-2xl font-semibold text-ink-cacao">
          {t("profile.orders.title")}
        </h2>
      </div>
      <LocaleLink to="/account/orders" className="group flex min-h-14 w-full items-center justify-between border-b border-ink-cacao/20 py-4 text-left">
        <span>
          <span className="block font-sans text-sm font-medium text-ink-cacao">{t("profile.orders.link")}</span>
          <span className="mt-1 block font-sans text-xs text-ink-cacao/70">{t("profile.orders.body")}</span>
        </span>
        <ArrowRightIcon className="text-ink-cacao/70 group-hover:translate-x-1 group-hover:text-pod-wine" />
      </LocaleLink>
    </section>
  );
}
