// Everything about one request: its status (with a line that says what it means), what was asked, the quote when
// there is one, the notes, and the brand files that were sent, each with a Download button.
import type { ReactNode, RefObject } from "react";
import { formatCents, formatDate } from "../../../i18n/format";
import { useLang } from "../../../i18n/LanguageContext";
import { requestReference } from "../../../lib/requestReference";
import { isKnownStatus, type QuoteRequest } from "../requestTypes";
import { packagingLabel, profileLabel } from "../requestLabels";
import FileDownload from "./FileDownload";
import StatusBadge from "./StatusBadge";

interface RequestDetailsProps {
  request: QuoteRequest;
  // the heading takes the focus when a request is chosen, so a screen reader starts reading its details
  headingRef: RefObject<HTMLHeadingElement | null>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-ink-cacao/15 py-3">
      <dt className="shrink-0 font-sans text-[11px] uppercase tracking-widest text-ink-cacao/70">{label}</dt>
      <dd className="min-w-0 break-words text-right font-spectral text-sm text-ink-cacao">{children}</dd>
    </div>
  );
}

export default function RequestDetails({ request, headingRef }: RequestDetailsProps) {
  const { t, lang } = useLang();
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
