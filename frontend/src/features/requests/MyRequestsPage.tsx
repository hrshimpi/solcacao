// "My quote requests": the requests a business account sent from the studio, with their status and, once there is
// one, their quote. The list is a column on the left like the shop filters, the details of the chosen request are
// on the right (below the list on a phone). The chosen request is in the address (?request=), so it can be shared
// with a colleague, kept when the page is refreshed, and linked to from the studio after sending.
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { useLang } from "../../i18n/LanguageContext";
import { usePageTitle } from "../../lib/usePageTitle";
import LocaleLink from "../../ui/LocaleLink";
import RequestDetails from "./components/RequestDetails";
import RequestList from "./components/RequestList";
import { problemMessage } from "./requestLabels";
import { useMyRequests } from "./useMyRequests";

const actionButton =
  "min-h-11 border border-ink-cacao px-5 py-2 font-sans text-sm font-medium text-ink-cacao hover:bg-ink-cacao hover:text-paper-text disabled:opacity-70";

export default function MyRequestsPage() {
  const { t } = useLang();
  usePageTitle(t("titles.requests"));

  const { list, error, loading, refresh } = useMyRequests();
  const [params] = useSearchParams();
  const selectedId = params.get("request");
  const selected = list?.items.find((request) => request.id === selectedId) ?? null;

  // choosing a request moves focus to its details. A request that was already open when the page loaded does not take the focus.
  const detailsHeading = useRef<HTMLHeadingElement>(null);
  const picked = useRef(false);
  useEffect(() => {
    if (picked.current && selected) detailsHeading.current?.focus();
    picked.current = false;
  }, [selected]);

  const problem = error ? problemMessage(error, t) : "";

  return (
    <div className="bg-stone-paper">
      <div className="border-b border-ink-cacao">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-6 md:py-14">
          <div>
            <p className="mb-3 font-sans text-[11px] uppercase tracking-[0.18em] text-pod-wine">{t("b2b.requests.eyebrow")}</p>
            <h1 className="font-spectral text-4xl font-semibold tracking-tight text-ink-cacao md:text-5xl">{t("b2b.requests.title")}</h1>
          </div>
          <LocaleLink
            to="/wholesale/studio"
            className="inline-flex min-h-11 items-center self-start border border-sun-gold bg-sun-gold px-6 py-3 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/85 sm:self-auto"
          >
            {t("b2b.requests.newRequest")}
          </LocaleLink>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-16" aria-busy={loading}>
        {!list && loading && (
          <div role="status" className="max-w-xl">
            <p className="mb-6 font-sans text-sm text-ink-cacao/70">{t("b2b.requests.loading")}</p>
            <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
              <div className="h-16 bg-clay-surface" />
              <div className="h-16 bg-clay-surface" />
              <div className="h-16 bg-clay-surface" />
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="mb-8 max-w-xl border-l-4 border-pod-wine bg-clay-surface p-4">
            <p className="font-sans text-sm font-medium text-pod-wine">{t("b2b.requests.loadFailed")}</p>
            <p className="mt-1 font-sans text-sm text-ink-cacao">{problem}</p>
            <button type="button" onClick={() => void refresh()} disabled={loading} className={`${actionButton} mt-3`}>
              {t("b2b.requests.retry")}
            </button>
          </div>
        )}

        {list && list.items.length === 0 && (
          <div className="max-w-xl border border-ink-cacao bg-clay-surface p-8">
            <h2 className="mb-3 font-spectral text-2xl font-semibold text-ink-cacao">{t("b2b.requests.empty.title")}</h2>
            <p className="mb-6 font-spectral text-ink-cacao/80">{t("b2b.requests.empty.body")}</p>
            <LocaleLink
              to="/wholesale/studio"
              className="inline-flex min-h-11 items-center bg-ink-cacao px-8 py-3 font-sans text-sm font-medium text-stone-paper hover:bg-pod-wine"
            >
              {t("b2b.requests.empty.action")}
            </LocaleLink>
          </div>
        )}

        {list && list.items.length > 0 && (
          <div className="grid gap-12 lg:grid-cols-[20rem_1fr] lg:gap-16">
            <section aria-labelledby="request-list-heading">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="request-list-heading" className="font-sans text-[11px] font-medium uppercase tracking-widest text-ink-cacao/70">
                  {t("b2b.requests.listLabel")}
                </h2>
                <button type="button" onClick={() => void refresh()} disabled={loading} className={`${actionButton} px-3 py-1 text-xs`}>
                  {loading ? t("b2b.requests.refreshing") : t("b2b.requests.refresh")}
                </button>
              </div>
              <RequestList
                items={list.items}
                selectedId={selected?.id ?? null}
                onPick={() => {
                  picked.current = true;
                }}
              />
              {list.total > list.items.length && (
                <p className="mt-4 font-sans text-xs text-ink-cacao/70">
                  {t("b2b.requests.moreNote", { shown: list.items.length, total: list.total })}
                </p>
              )}
            </section>

            <div>
              {selected ? (
                <RequestDetails request={selected} headingRef={detailsHeading} />
              ) : (
                <p className="font-spectral text-ink-cacao/70">{selectedId ? t("b2b.requests.notFoundSelected") : t("b2b.requests.choose")}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
