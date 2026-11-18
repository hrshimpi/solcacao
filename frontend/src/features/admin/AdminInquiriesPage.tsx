// The messages from the contact form and the newsletter box: a list with a filter by status, and a button on each one that marks
// it as answered (or as new again). Fifteen at a time.
import { useEffect, useState } from "react";
import { fetchInquiries, setInquiryStatus, type Inquiry, type InquiryStatus } from "../../api/admin";
import { formatDate } from "../../i18n/format";
import { useLang } from "../../i18n/LanguageContext";
import { useAnnounce } from "../../ui/LiveRegion";

const PAGE_SIZE = 15;

function Card({ inquiry, onChange }: { inquiry: Inquiry; onChange: (inquiry: Inquiry) => void }) {
  const { t, lang } = useLang();
  const announce = useAnnounce();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function toggle() {
    setBusy(true);
    setProblem("");
    try {
      const changed = await setInquiryStatus(inquiry.id, inquiry.status === "new" ? "responded" : "new", { lang });
      onChange(changed);
      announce(t(`admin.inquiries.status.${changed.status}`));
    } catch {
      setProblem(t("admin.inquiries.changeError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="border border-ink-cacao/30 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-sans text-[11px] uppercase tracking-widest text-pod-wine">{t(`admin.inquiries.category.${inquiry.category}`)}</p>
          <h2 className="mt-1 font-spectral text-xl font-semibold text-ink-cacao">{inquiry.name ? t("admin.inquiries.from", { name: inquiry.name }) : (inquiry.email || t("admin.inquiries.anonymous"))}</h2>
          <p className="mt-1 font-sans text-xs text-ink-cacao/70">
            {inquiry.email && inquiry.name ? `${inquiry.email} · ` : ""}
            {formatDate(inquiry.createdAt, lang)}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 border border-ink-cacao/30 px-2.5 py-1 font-sans text-[11px] uppercase tracking-widest text-ink-cacao">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${inquiry.status === "new" ? "bg-sun-gold" : "bg-canopy-green"}`} />
          {t(`admin.inquiries.status.${inquiry.status}`)}
        </span>
      </div>

      {inquiry.rating !== null && <p className="mt-3 font-sans text-sm text-ink-cacao">{t("admin.inquiries.rating", { count: inquiry.rating })}</p>}
      {inquiry.message && <p className="mt-3 whitespace-pre-line font-sans text-sm leading-relaxed text-ink-cacao">{inquiry.message}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink-cacao/20 pt-4">
        <button type="button" onClick={() => void toggle()} disabled={busy} className="min-h-11 border border-ink-cacao px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-clay-surface disabled:opacity-60">
          {inquiry.status === "new" ? t("admin.inquiries.markResponded") : t("admin.inquiries.markNew")}
        </button>
        {inquiry.email && (
          <a href={`mailto:${inquiry.email}`} className="inline-flex min-h-11 items-center font-sans text-xs text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
            {t("admin.inquiries.reply")}
          </a>
        )}
        {problem && (
          <p role="alert" className="font-sans text-xs text-pod-wine">
            {problem}
          </p>
        )}
      </div>
    </article>
  );
}

export default function AdminInquiriesPage() {
  const { t, lang } = useLang();
  const [status, setStatus] = useState<InquiryStatus | "">("");
  const [items, setItems] = useState<Inquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<"loading" | "failed" | "ready">("loading");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => (current === "ready" && page > 1 ? current : "loading"));
    fetchInquiries({ status: status || undefined, page, limit: PAGE_SIZE, lang, signal: controller.signal })
      .then((answer) => {
        // the next page is added to the ones that are there, the first one starts the list again
        setItems((current) => (page === 1 ? answer.items : [...current, ...answer.items.filter((item) => !current.some((known) => known.id === item.id))]));
        setTotal(answer.total);
        setState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("failed");
      });
    return () => controller.abort();
  }, [status, page, lang, attempt]);

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <label htmlFor="admin-inquiries-status" className="block font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">
            {t("admin.inquiries.statusFilter")}
          </label>
          <select
            id="admin-inquiries-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as InquiryStatus | "");
              setPage(1);
            }}
            className="mt-1 block min-h-11 border-b border-ink-cacao/60 bg-transparent py-2 font-sans text-sm text-ink-cacao focus:border-ink-cacao focus:outline-none"
          >
            <option value="">{t("admin.inquiries.all")}</option>
            <option value="new">{t("admin.inquiries.status.new")}</option>
            <option value="responded">{t("admin.inquiries.status.responded")}</option>
          </select>
        </div>
        <p role="status" className="font-sans text-xs text-ink-cacao/70">
          {state === "ready" ? t("admin.inquiries.count", { count: total }) : ""}
        </p>
      </div>

      {state === "loading" && (
        <p role="status" className="font-sans text-sm text-ink-cacao/70">
          {t("admin.loading")}
        </p>
      )}
      {state === "failed" && (
        <div role="alert" className="flex flex-wrap items-center gap-4 border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
          <span>{t("admin.loadError")}</span>
          <button type="button" onClick={() => setAttempt((count) => count + 1)} className="min-h-11 underline underline-offset-4 hover:text-pod-wine">
            {t("common.retry")}
          </button>
        </div>
      )}

      {state === "ready" && items.length === 0 && <p className="border border-ink-cacao/30 p-6 font-spectral text-ink-cacao">{t("admin.inquiries.empty")}</p>}

      {state === "ready" && items.length > 0 && (
        <>
          <div className="space-y-5">
            {items.map((inquiry) => (
              <Card key={inquiry.id} inquiry={inquiry} onChange={(changed) => setItems((current) => current.map((item) => (item.id === changed.id ? changed : item)))} />
            ))}
          </div>
          {items.length < total && (
            <div className="mt-8 text-center">
              <button type="button" onClick={() => setPage(page + 1)} className="min-h-11 border border-ink-cacao px-6 py-2 font-sans text-sm font-medium text-ink-cacao hover:bg-clay-surface">
                {t("admin.inquiries.more")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
