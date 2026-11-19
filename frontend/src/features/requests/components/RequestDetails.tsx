// Everything about one request: its status (with a line that says what it means), what was asked, the quote when
// there is one, the notes, and the brand files that were sent, each with a Download button.
import { useState, type ReactNode, type RefObject } from "react";
import { formatCents, formatDate } from "../../../i18n/format";
import { useLang } from "../../../i18n/LanguageContext";
import { api } from "../../../lib/api";
import { requestReference } from "../../../lib/requestReference";
import { isKnownStatus, type QuoteRequest } from "../requestTypes";
import { packagingLabel, profileLabel } from "../requestLabels";
import FileDownload from "./FileDownload";
import StatusBadge from "./StatusBadge";

interface RequestDetailsProps {
  request: QuoteRequest;
  // the heading takes the focus when a request is chosen, so a screen reader starts reading its details
  headingRef: RefObject<HTMLHeadingElement | null>;
  // called after the business accepted or declined the quote, so the list is read again
  onAnswered?: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-ink-cacao/15 py-3">
      <dt className="shrink-0 font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">{label}</dt>
      <dd className="min-w-0 break-words text-right font-spectral text-sm text-ink-cacao">{children}</dd>
    </div>
  );
}

export default function RequestDetails({ request, headingRef, onAnswered }: RequestDetailsProps) {
  const { t, lang } = useLang();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  async function answer(decision: "accept" | "decline") {
    setBusy(true);
    setProblem("");
    try {
      await api.post(`/b2b/requests/${request.id}/respond`, { lang, json: { decision } });
      onAnswered?.();
    } catch {
      setProblem(t("b2b.requests.respond.error"));
    } finally {
      setBusy(false);
    }
  }

  const reference = requestReference(request.id);

  return (
    <section aria-labelledby="request-details-heading">
      <div className="border-b border-ink-cacao pb-4">
        <h2 id="request-details-heading" ref={headingRef} tabIndex={-1} className="font-spectral text-2xl font-semibold text-ink-cacao">
          {t("b2b.requests.detailsTitle", { reference })}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatusBadge status={request.status} />
          {isKnownStatus(request.status) && <p className="font-sans text-xs text-ink-cacao/70">{t(`b2b.requests.statusHelp.${request.status}`)}</p>}
        </div>
      </div>

      <dl>
        <Row label={t("b2b.requests.fields.sent")}>{formatDate(request.createdAt, lang)}</Row>
        <Row label={t("studio.summaryProfile")}>{profileLabel(request.cacaoProfile, t)}</Row>
        <Row label={t("studio.summaryPackaging")}>{packagingLabel(request.packagingType, t)}</Row>
        <Row label={t("studio.units")}>{t("b2b.requests.units", { count: request.quantityEstimate })}</Row>
        <Row label={t("studio.company")}>{request.companyName}</Row>
        <Row label={t("studio.contact")}>{request.contactName}</Row>
        {request.quoteAmount !== null && (
          <Row label={t("b2b.requests.fields.quote")}>
            <span className="text-lg font-semibold">{formatCents(request.quoteAmount, lang)}</span>
          </Row>
        )}
        {request.quoteNote && <Row label={t("b2b.requests.fields.quoteNote")}><span className="whitespace-pre-line">{request.quoteNote}</span></Row>}
        {request.notes && <Row label={t("studio.notes")}><span className="whitespace-pre-line">{request.notes}</span></Row>}
      </dl>

      {request.status === "quoted" && (
        <div className="mt-6 border border-ink-cacao/30 p-4">
          <p className="font-sans text-sm text-ink-cacao">{t("b2b.requests.respond.question")}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => void answer("accept")} disabled={busy} className="min-h-11 border border-ink-cacao bg-ink-cacao px-4 py-2 font-sans text-xs font-medium text-stone-paper hover:opacity-90 disabled:opacity-60">
              {t("b2b.requests.respond.accept")}
            </button>
            <button type="button" onClick={() => void answer("decline")} disabled={busy} className="min-h-11 border border-pod-wine px-4 py-2 font-sans text-xs font-medium text-pod-wine hover:bg-clay-surface disabled:opacity-60">
              {t("b2b.requests.respond.decline")}
            </button>
          </div>
          {problem && <p role="alert" className="mt-3 font-sans text-xs text-pod-wine">{problem}</p>}
        </div>
      )}
      {request.status === "approved" && <p className="mt-6 border-l-4 border-canopy-green bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">{t("b2b.requests.respond.afterAccept")}</p>}

      <h3 className="mb-2 mt-8 font-sans text-[11px] font-medium uppercase tracking-widest text-ink-cacao/70">{t("studio.summaryAssets")}</h3>
      {request.brandAssets.length > 0 ? (
        <ul>
          {request.brandAssets.map((asset) => (
            <FileDownload key={asset.storedName} requestId={request.id} asset={asset} />
          ))}
        </ul>
      ) : (
        <p className="font-sans text-sm text-ink-cacao/70">{t("b2b.requests.noFiles")}</p>
      )}
    </section>
  );
}
