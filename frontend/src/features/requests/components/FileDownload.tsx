// A brand file of a request, with its Download button. The file is protected, so a plain link would reach it without
// the Authorization header: it is fetched with api.download and then saved from memory. A problem is shown next to the file.
import { useEffect, useRef, useState } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import { api } from "../../../lib/api";
import { saveBlob } from "../../../lib/saveBlob";
import { useAnnounce } from "../../../ui/LiveRegion";
import { formatSize } from "../../studio/studioOptions";
import { problemMessage } from "../requestLabels";
import type { BrandAsset } from "../requestTypes";

interface FileDownloadProps {
  requestId: string;
  asset: BrandAsset;
}

export default function FileDownload({ requestId, asset }: FileDownloadProps) {
  const { t, lang } = useLang();
  const announce = useAnnounce();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const running = useRef<AbortController | null>(null);

  // leaving the page stops a download that is still on its way
  useEffect(() => () => running.current?.abort(), []);

  async function save() {
    if (busy) return;
    const controller = new AbortController();
    running.current = controller;
    setBusy(true);
    setProblem("");

    try {
      const file = await api.download(`/b2b/requests/${encodeURIComponent(requestId)}/assets/${encodeURIComponent(asset.storedName)}`, {
        lang,
        signal: controller.signal,
      });
      saveBlob(file, asset.originalName);
      announce(t("b2b.requests.downloaded", { name: asset.originalName }));
    } catch (error) {
      if (!controller.signal.aborted) setProblem(`${t("b2b.requests.downloadFailed", { name: asset.originalName })} ${problemMessage(error, t)}`);
    } finally {
      if (running.current === controller) running.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <li className="border-b border-ink-cacao/10 py-1">
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-0 break-words font-sans text-sm text-ink-cacao">
          {asset.originalName} <span className="text-ink-cacao/70">({formatSize(asset.sizeBytes)})</span>
        </span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          aria-label={t("b2b.requests.downloadFile", { name: asset.originalName })}
          className="min-h-11 shrink-0 border border-ink-cacao px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-ink-cacao hover:text-paper-text disabled:opacity-70"
        >
          {busy ? t("b2b.requests.downloading") : t("b2b.requests.download")}
        </button>
      </div>
      {problem && (
        <p role="alert" className="pb-2 font-sans text-sm font-medium text-pod-wine">
          {problem}
        </p>
      )}
    </li>
  );
}
