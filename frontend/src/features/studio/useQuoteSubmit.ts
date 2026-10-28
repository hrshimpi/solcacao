// Sends the wizard as a quote request and keeps track of how it is going: sending (with how much of the files went
// up), sent (with the reference of the request) or a problem, in which case nothing is lost and it can be sent again.
import { useRef, useState } from "react";
import { useLang } from "../../i18n/LanguageContext";
import { api } from "../../lib/api";
import { ApiError } from "../../lib/apiFetch";
import { requestReference } from "../../lib/requestReference";
import { useAnnounce } from "../../ui/LiveRegion";
import { buildQuoteForm, type ReadyWizardState } from "./quoteRequest";
import { clearDraft } from "./studioDraft";
import { MAX_FILE_MB } from "./studioOptions";

export type SendStatus = "editing" | "sending" | "sent";

interface QuoteAnswer {
  request?: { id?: unknown };
}

export function useQuoteSubmit() {
  const { lang, t } = useLang();
  const announce = useAnnounce();
  const [status, setStatus] = useState<SendStatus>("editing");
  // from 0 to 1 while files go up, null when there is nothing to show
  const [progress, setProgress] = useState<number | null>(null);
  // a new object for every problem, so the page can react to a second one that says the same
  const [failure, setFailure] = useState<{ detail: string } | null>(null);
  const [reference, setReference] = useState("");
  // the id of the saved request, for a link that opens it. Empty when the server did not say.
  const [requestId, setRequestId] = useState("");
  // set at the moment sending starts: the state only changes after the next render, and a quick second click would get through
  const busy = useRef(false);

  function describe(error: unknown) {
    if (error instanceof ApiError) {
      if (error.status === 0) return t("b2b.submit.errors.network");
      if (error.status === 401) return t("b2b.submit.errors.signedOut");
      if (error.status === 403) return t("b2b.submit.errors.notBusiness");
      if (error.status === 413) return t("b2b.submit.errors.tooBig", { size: MAX_FILE_MB });
      if (error.status === 429) return t("b2b.submit.errors.rateLimited");
      // for anything else the server explained, its own words
      if (error.code) return error.message;
    }
    return t("b2b.submit.errors.unknown");
  }

  async function send(state: ReadyWizardState) {
    if (busy.current) return;
    busy.current = true;
    setStatus("sending");
    setFailure(null);
    setProgress(state.files.length > 0 ? 0 : null);
    announce(t("b2b.submit.sendingAnnounce"));

    try {
      const answer = await api.upload<QuoteAnswer>("/b2b/quote", buildQuoteForm(state), {
        lang,
        onProgress: state.files.length > 0 ? setProgress : undefined,
      });
      // the request exists now, so what the draft held is not needed any more, even if the page was left meanwhile
      clearDraft();
      const id = answer?.request?.id;
      // an answer without an id is still a saved request, so it is not shown as a failure (that would invite a second one)
      setReference(typeof id === "string" ? requestReference(id) : "");
      setRequestId(typeof id === "string" ? id : "");
      setStatus("sent");
      announce(t("studio.sentAnnounce"));
    } catch (error) {
      setFailure({ detail: describe(error) });
      setStatus("editing");
    } finally {
      busy.current = false;
    }
  }

  return { status, progress, failure, reference, requestId, send };
}
