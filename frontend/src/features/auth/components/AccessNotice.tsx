// The short message of a page that is only for business accounts, shown to a retail account: what the page is for,
// a way to create a business account, and a way back.
import { usePageTitle } from "../../../lib/usePageTitle";
import LocaleLink from "../../../ui/LocaleLink";

interface AccessNoticeProps {
  pageTitle: string;
  eyebrow: string;
  title: string;
  body: string;
  createLabel: string;
  backTo: string;
  backLabel: string;
}

export default function AccessNotice({ pageTitle, eyebrow, title, body, createLabel, backTo, backLabel }: AccessNoticeProps) {
  usePageTitle(pageTitle);

  return (
    <div className="min-h-[60dvh] bg-stone-paper">
      <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
        <p className="mb-4 font-sans text-[11px] uppercase tracking-[0.2em] text-pod-wine">{eyebrow}</p>
        <h1 className="mb-4 font-spectral text-4xl font-semibold text-ink-cacao">{title}</h1>
        <p className="mb-8 max-w-xl font-spectral text-ink-cacao/70">{body}</p>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <LocaleLink
            to="/account/register?type=business"
            className="inline-flex min-h-11 items-center bg-ink-cacao px-8 py-3 font-sans text-sm font-medium text-stone-paper hover:bg-pod-wine"
          >
            {createLabel}
          </LocaleLink>
          <LocaleLink to={backTo} className="inline-flex min-h-11 items-center font-sans text-sm underline underline-offset-4 hover:text-pod-wine">
            {backLabel}
          </LocaleLink>
        </div>
      </div>
    </div>
  );
}
