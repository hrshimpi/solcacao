// The contact page: a category, name, email and message form, plus a WhatsApp link. The message goes to the inquiries API.
import { useEffect, useRef, useState } from "react";
import { sendInquiry } from "../../api/inquiries";
import { useLang } from "../../i18n/LanguageContext";
import { useForm } from "../../lib/useForm";
import { usePageTitle } from "../../lib/usePageTitle";
import { email, maxLength, minLength, required } from "../../lib/validation";
import { WhatsAppIcon } from "../../ui/Icons";
import { useAnnounce } from "../../ui/LiveRegion";
import RadioRow from "../../ui/RadioRow";
import TextField from "../../ui/TextField";
import { inquiryProblem } from "./inquiryMessages";

const categoryIds = ["general", "wholesale", "support"] as const;
type CategoryId = (typeof categoryIds)[number];

const whatsappNumber = "15551234567";

export default function ContactPage() {
  const { t, lang } = useLang();
  const announce = useAnnounce();
  usePageTitle(t("titles.contact"));
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(t("footer.whatsappMessage"))}`;

  const [category, setCategory] = useState<CategoryId>("general");
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState("");
  const sentRef = useRef<HTMLHeadingElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);

  const form = useForm({
    initial: { name: "", email: "", message: "" },
    rules: {
      name: [required, minLength(2), maxLength(80)],
      email: [required, email],
      message: [required, minLength(10), maxLength(1000)],
    },
    onSubmit: async (values) => {
      setProblem("");
      try {
        await sendInquiry({ category, name: values.name.trim(), email: values.email.trim(), message: values.message.trim() }, lang);
        setSent(true);
        announce(t("contact.sentAnnounce"));
      } catch (error) {
        const found = inquiryProblem(error, t);
        if (Object.keys(found.fields).length > 0) form.setFieldErrors(found.fields);
        if (found.form) setProblem(found.form);
      }
    },
  });

  useEffect(() => {
    if (sent) sentRef.current?.focus();
  }, [sent]);

  useEffect(() => {
    if (problem) problemRef.current?.focus();
  }, [problem]);

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
          </div>
        ) : (
          <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate aria-busy={form.submitting} className="space-y-6">
            {problem && (
              <div ref={problemRef} role="alert" tabIndex={-1} className="border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
                {problem}
              </div>
            )}
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
                {form.submitting ? t("contact.sending") : t("contact.send")}
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
