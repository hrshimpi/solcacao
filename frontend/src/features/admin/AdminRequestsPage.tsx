// The quote requests of the business accounts: every request with its files, and for a new one the buttons to send a quote
// (the amount in dollars) or to reject it. Fifteen at a time.
import { useEffect, useState } from "react";
import { changeRequest, fetchAdminRequests } from "../../api/admin";
import { formatCents, formatDate, formatNumber } from "../../i18n/format";
import { useLang } from "../../i18n/LanguageContext";
import { useAnnounce } from "../../ui/LiveRegion";
import FileDownload from "../requests/components/FileDownload";
import StatusBadge from "../requests/components/StatusBadge";
import { packagingLabel, profileLabel } from "../requests/requestLabels";
import type { QuoteRequest } from "../requests/requestTypes";

const PAGE_SIZE = 15;

function Card({ request, onChange }: { request: QuoteRequest; onChange: (request: QuoteRequest) => void }) {
  const { t, lang } = useLang();
  const announce = useAnnounce();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function send(change: { status: string; quoteAmount?: number }) {
    setBusy(true);
    setProblem("");
    try {
      const changed = await changeRequest(request.id, change, { lang });
      onChange(changed);
      announce(t(`b2b.requests.status.${changed.status}` as "b2b.requests.status.quoted"));
    } catch {
      setProblem(t("admin.requests.changeError"));
    } finally {
      setBusy(false);
    }
  }

  function sendQuote() {
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setProblem(t("admin.requests.invalidAmount"));
      return;
    }
    void send({ status: "quoted", quoteAmount: Math.round(dollars * 100) });
  }

  return (
    <article className="border border-ink-cacao/30 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-spectral text-xl font-semibold text-ink-cacao">{request.companyName}</h2>
          <p className="mt-1 font-sans text-xs text-ink-cacao/70">
            {request.contactName} · {formatDate(request.createdAt, lang)}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <p className="mt-3 font-sans text-sm text-ink-cacao">
        {profileLabel(request.cacaoProfile, t)} · {packagingLabel(request.packagingType, t)} · {t("admin.requests.units", { units: formatNumber(request.quantityEstimate, lang) })}
      </p>
      {(request.contactEmail || request.contactPhone) && (
        <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-sans text-sm text-ink-cacao">
          {request.contactEmail && (
            <a href={`mailto:${request.contactEmail}?subject=${encodeURIComponent(t("admin.requests.mailSubject", { company: request.companyName }))}`} className="underline underline-offset-4 hover:text-pod-wine">
              {request.contactEmail}
            </a>
          )}
          {request.contactPhone && (
            <a href={`tel:${request.contactPhone}`} className="underline underline-offset-4 hover:text-pod-wine">
              {request.contactPhone}
            </a>
          )}
        </p>
      )}
      {request.notes && <p className="mt-3 whitespace-pre-line font-sans text-sm leading-relaxed text-ink-cacao">{request.notes}</p>}

      {request.brandAssets.length > 0 && (
        <ul className="mt-3 space-y-1">
          {request.brandAssets.map((asset) => (
            <li key={asset.storedName}>
              <FileDownload requestId={request.id} asset={asset} />
            </li>
          ))}
        </ul>
      )}

      {request.quoteAmount !== null && <p className="mt-3 font-sans text-sm font-medium text-ink-cacao">{t("admin.requests.quoted", { amount: formatCents(request.quoteAmount, lang) })}</p>}

      {request.status === "submitted" && (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-ink-cacao/20 pt-4">
          <div>
            <label htmlFor={`quote-${request.id}`} className="block font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">
              {t("admin.requests.amountLabel")}
            </label>
            <input
              id={`quote-${request.id}`}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="1200"
              className="mt-1 block min-h-11 w-36 border-b border-ink-cacao/60 bg-transparent py-2 font-sans text-sm text-ink-cacao focus:border-ink-cacao focus:outline-none"
            />
          </div>
          <button type="button" onClick={sendQuote} disabled={busy} className="min-h-11 border border-ink-cacao px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-clay-surface disabled:opacity-60">
            {t("admin.requests.sendQuote")}
          </button>
          {request.contactEmail && (
            <a href={`mailto:${request.contactEmail}?subject=${encodeURIComponent(t("admin.requests.mailSubject", { company: request.companyName }))}`} className="inline-flex min-h-11 items-center border border-ink-cacao px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-clay-surface">
              {t("admin.requests.emailCustomer")}
            </a>
          )}
          <button type="button" onClick={() => void send({ status: "rejected" })} disabled={busy} className="min-h-11 border border-pod-wine px-4 py-2 font-sans text-xs font-medium text-pod-wine hover:bg-clay-surface disabled:opacity-60">
            {t("admin.requests.reject")}
          </button>
        </div>
      )}
      {problem && (
        <p role="alert" className="mt-3 font-sans text-xs text-pod-wine">
          {problem}
        </p>
      )}
    </article>
  );
}

export default function AdminRequestsPage() {
  const { t, lang } = useLang();
  const [items, setItems] = useState<QuoteRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<"loading" | "failed" | "ready">("loading");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => (current === "ready" && page > 1 ? current : "loading"));
    fetchAdminRequests({ page, limit: PAGE_SIZE, lang, signal: controller.signal })
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
  }, [page, lang, attempt]);

  return (
    <div>
      <p role="status" className="mb-8 font-sans text-xs text-ink-cacao/70">
        {state === "ready" ? t("admin.requests.count", { count: total }) : ""}
      </p>

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

      {state === "ready" && items.length === 0 && <p className="border border-ink-cacao/30 p-6 font-spectral text-ink-cacao">{t("admin.requests.empty")}</p>}

      {state === "ready" && items.length > 0 && (
        <>
          <div className="space-y-5">
            {items.map((request) => (
              <Card key={request.id} request={request} onChange={(changed) => setItems((current) => current.map((item) => (item.id === changed.id ? changed : item)))} />
            ))}
          </div>
          {items.length < total && (
            <div className="mt-8 text-center">
              <button type="button" onClick={() => setPage(page + 1)} className="min-h-11 border border-ink-cacao px-6 py-2 font-sans text-sm font-medium text-ink-cacao hover:bg-clay-surface">
                {t("admin.requests.more")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
