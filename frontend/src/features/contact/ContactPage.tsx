// The contact page: a category, name, email and message form, plus a WhatsApp link. Sending is simulated.
import { useEffect, useRef, useState } from "react";
import { useLang } from "../../i18n/LanguageContext";
import { useForm } from "../../lib/useForm";
import { usePageTitle } from "../../lib/usePageTitle";
import { email, maxLength, minLength, required } from "../../lib/validation";
import { WhatsAppIcon } from "../../ui/Icons";
import { useAnnounce } from "../../ui/LiveRegion";
import RadioRow from "../../ui/RadioRow";
import TextField from "../../ui/TextField";

const categoryIds = ["general", "wholesale", "support"] as const;
type CategoryId = (typeof categoryIds)[number];

const whatsappUrl = "https://wa.me/15551234567";

export default function ContactPage() {
  const { t } = useLang();
  const announce = useAnnounce();
  usePageTitle(t("titles.contact"));

  const [category, setCategory] = useState<CategoryId>("general");
  const [sent, setSent] = useState(false);
  const sentRef = useRef<HTMLHeadingElement>(null);

  const form = useForm({
    initial: { name: "", email: "", message: "" },
    rules: {
      name: [required, maxLength(80)],
      email: [required, email],
      message: [required, minLength(10), maxLength(1000)],
    },
    onSubmit: () => {
      setSent(true);
      announce(t("contact.sentAnnounce"));
    },
  });

  useEffect(() => {
    if (sent) sentRef.current?.focus();
  }, [sent]);

  return (
    <div className="bg-stone-paper">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="mb-2 font-spectral text-3xl font-semibold text-ink-cacao">{t("contact.title")}</h1>
        <p className="mb-10 font-spectral text-ink-cacao/70">{t("contact.intro")}</p>

        {sent ? (
          <div className="border border-ink-cacao bg-clay-surface p-8 text-center sm:p-10">
            <h2 ref={sentRef} tabIndex={-1} className="mb-2 font-spectral text-xl font-semibold text-ink-cacao">
              {t("contact.sentTitle")}
            </h2>
            <p className="font-spectral text-ink-cacao/70">{t("contact.sentBody")}</p>
            <p className="mt-4 font-sans text-xs text-ink-cacao/70">{t("contact.sentPreview")}</p>
          </div>
        ) : (
          <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate className="space-y-6">
            <RadioRow
              legend={t("contact.category")}
              name="category"
              value={category}
              onChange={setCategory}
              options={categoryIds.map((id) => ({ id, label: t(`contact.categories.${id}`) }))}
            />
            <p className="font-sans text-xs text-ink-cacao/70">{t("common.requiredNote")}</p>

            <div className="grid gap-6 md:grid-cols-2">
              <TextField label={t("contact.name")} autoComplete="name" required placeholder="Isabel Vásquez" {...form.field("name")} />
              <TextField
                label={t("contact.email")}
                type="email"
                autoComplete="email"
                required
                placeholder="you@domain.com"
                {...form.field("email")}
              />
            </div>
            <TextField
              label={t("contact.message")}
              multiline
              rows={5}
              required
              placeholder={t("contact.messagePlaceholder")}
              {...form.field("message")}
            />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                className="min-h-11 bg-sun-gold px-8 py-3 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90"
              >
                {t("contact.send")}
              </button>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine"
              >
                <WhatsAppIcon className="text-canopy-green" />
                {t("footer.whatsapp")}
                <span className="sr-only"> {t("footer.opensNewTab")}</span>
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
