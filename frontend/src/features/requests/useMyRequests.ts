// Loads the quote requests of the signed in person and keeps them up to date. An admin changes a status on the
// server, so the list is read again when the person comes back to the tab and when they press Refresh, and a status
// that changed is announced to screen readers. The list that was there stays while it is read again.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "../../i18n/LanguageContext";
import { api } from "../../lib/api";
import { ApiError } from "../../lib/apiFetch";
import { requestReference } from "../../lib/requestReference";
import { useAnnounce } from "../../ui/LiveRegion";
import { statusText } from "./requestLabels";
import { parseRequestList, type RequestList } from "./requestTypes";

// the API gives at most 100 requests in one answer, which is plenty for the requests of one company
const LIMIT = 100;
// coming back to the tab reads the list again, but not when it was read just now
const STALE_AFTER_MS = 5000;

export function useMyRequests() {
  const { lang, t } = useLang();
  const announce = useAnnounce();
  const [list, setList] = useState<RequestList | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  // the latest of these, for load() to read without having to change when they do
  const latest = useRef({ lang, t, announce });
  const shown = useRef<RequestList | null>(null);
  const running = useRef<AbortController | null>(null);
  const loadedAt = useRef(0);

  useEffect(() => {
    latest.current = { lang, t, announce };
  });

  const load = useCallback(async () => {
    // a newer read replaces one that is still on its way
    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    setLoading(true);

    try {
      const answer = await api.get<unknown>("/b2b/requests", { lang: latest.current.lang, query: { limit: LIMIT }, signal: controller.signal });
      const next = parseRequestList(answer);
      if (!next) throw new ApiError("The answer was not what we expected.", 200);

      const { t: translate, announce: say } = latest.current;
      const changes = (shown.current?.items ?? []).flatMap((before) => {
        const now = next.items.find((item) => item.id === before.id);
        if (!now || now.status === before.status) return [];
        return [translate("b2b.requests.statusChanged", { reference: requestReference(now.id), status: statusText(now.status, translate).toLowerCase() })];
      });
      if (changes.length > 0) say(changes.join(" "));

      shown.current = next;
      loadedAt.current = Date.now();
      setList(next);
      setError(null);
    } catch (problem) {
      // replaced by a newer read, or the page was left: nothing to show
      if (controller.signal.aborted) return;
      loadedAt.current = Date.now();
      setError(problem instanceof ApiError ? problem : new ApiError("The server could not be reached."));
    } finally {
      if (running.current === controller) {
        running.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
    return () => running.current?.abort();
  }, [load]);

  useEffect(() => {
    function readAgain() {
      if (document.visibilityState === "hidden" || Date.now() - loadedAt.current < STALE_AFTER_MS) return;
      void load();
    }
    window.addEventListener("focus", readAgain);
    document.addEventListener("visibilitychange", readAgain);
    return () => {
      window.removeEventListener("focus", readAgain);
      document.removeEventListener("visibilitychange", readAgain);
    };
  }, [load]);

  return { list, error, loading, refresh: load };
}
