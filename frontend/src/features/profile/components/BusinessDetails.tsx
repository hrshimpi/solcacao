// The business details of a business account: the company, the tax id and the industry, which the person edits, and the
// verification, which our team decides and the person can only read. It loads its own data, with a loading and an error state.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import { api } from "../../../lib/api";
import { ApiError } from "../../../lib/apiFetch";
import { useForm } from "../../../lib/useForm";
import { maxLength, required } from "../../../lib/validation";
import { CheckIcon } from "../../../ui/Icons";
import { useAnnounce } from "../../../ui/LiveRegion";
import TextField from "../../../ui/TextField";
import { useAuth, type VerificationStatus } from "../../auth/AuthContext";

interface BusinessProfile {
  companyName: string;
  taxId?: string;
  industry?: string;
  verificationStatus: VerificationStatus;
}

type Load = { status: "loading" } | { status: "failed" } | { status: "ready"; profile: BusinessProfile };

function readProfile(value: unknown): BusinessProfile | null {
  const profile = typeof value === "object" && value !== null ? (value as { b2bProfile?: unknown }).b2bProfile : undefined;
  if (typeof profile !== "object" || profile === null) return null;
  const { companyName, taxId, industry, verificationStatus } = profile as Record<string, unknown>;
  if (typeof companyName !== "string") return null;
  return {
    companyName,
    ...(typeof taxId === "string" && taxId ? { taxId } : {}),
    ...(typeof industry === "string" && industry ? { industry } : {}),
    verificationStatus: verificationStatus === "verified" || verificationStatus === "rejected" ? verificationStatus : "pending",
  };
}

function Form({ profile, onSaved, onCancel }: { profile: BusinessProfile; onSaved: (profile: BusinessProfile) => void; onCancel: () => void }) {
  const { t, lang } = useLang();
  const announce = useAnnounce();
  const [problem, setProblem] = useState("");
  const problemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (problem) problemRef.current?.focus();
  }, [problem]);

  const form = useForm({
    initial: { company: profile.companyName, taxId: profile.taxId ?? "", industry: profile.industry ?? "" },
    rules: { company: [required, maxLength(120)], taxId: [maxLength(40)], industry: [maxLength(80)] },
    onSubmit: async (values) => {
      setProblem("");
      try {
        // an empty value takes the detail away
        const answer = await api.put<unknown>("/users/me/b2b-profile", { lang, json: { companyName: values.company.trim(), taxId: values.taxId.trim(), industry: values.industry.trim() } });
        const saved = readProfile(answer);
        if (!saved) throw new ApiError("The answer was not valid.");
        announce(t("profile.business.saved"));
        onSaved(saved);
      } catch (error) {
        if (error instanceof ApiError && error.code === "VALIDATION_ERROR" && error.details.some((detail) => detail.field === "companyName")) {
          form.setFieldErrors({ company: t("errors.required") });
          return;
        }
        setProblem(error instanceof ApiError && error.status === 0 ? t("profile.errors.network") : t("profile.errors.save"));
      }
    },
  });

  useEffect(() => {
    requestAnimationFrame(() => form.formRef.current?.querySelector("input")?.focus());
    // only when it opens
  }, []);

  return (
    <form ref={form.formRef} onSubmit={form.handleSubmit} noValidate aria-busy={form.submitting} className="pt-4">
      <p className="font-sans text-xs text-ink-cacao/70">{t("common.requiredNote")}</p>
      {problem && (
        <div ref={problemRef} role="alert" tabIndex={-1} className="mt-4 border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
          {problem}
        </div>
      )}
      <div className="grid gap-x-10 gap-y-6 py-6 sm:grid-cols-2">
        <TextField label={t("profile.business.company")} autoComplete="organization" required {...form.field("company")} />
        <TextField label={t("profile.business.taxId")} {...form.field("taxId")} />
        <TextField label={t("profile.business.industry")} {...form.field("industry")} />
      </div>
      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="min-h-11 border border-ink-cacao px-6 py-3 font-sans text-sm text-ink-cacao hover:bg-clay-surface">
          {t("profile.business.cancel")}
        </button>
        <button type="submit" className="min-h-11 bg-sun-gold px-7 py-3 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/85">
          {form.submitting ? t("profile.business.saving") : t("profile.business.save")}
        </button>
      </div>
    </form>
  );
}

export default function BusinessDetails() {
  const { t, lang } = useLang();
  const { user, updateUser } = useAuth();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  const read = useCallback(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    api
      .get<unknown>("/users/me/b2b-profile", { lang, signal: controller.signal })
      .then((answer) => {
        const profile = readProfile(answer);
        setLoad(profile ? { status: "ready", profile } : { status: "failed" });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: "failed" });
      });
    return () => controller.abort();
  }, [lang]);

  useEffect(() => read(), [read]);

  // when the form closes, its buttons are gone, so the keyboard goes back to the button that opened it
  useEffect(() => {
    if (wasEditing.current && !editing) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  if (!user) return null;

  return (
    <section aria-labelledby="profile-business" className="mt-14 md:mt-16">
      <div className="flex items-center justify-between gap-4 border-b border-ink-cacao pb-4">
        <h2 id="profile-business" className="font-spectral text-2xl font-semibold text-ink-cacao">
          {t("profile.business.title")}
        </h2>
        {load.status === "ready" && !editing && (
          <button
            ref={editButton}
            type="button"
            onClick={() => {
              setJustSaved(false);
              setEditing(true);
            }}
            className="min-h-11 border border-ink-cacao px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-clay-surface"
          >
            {t("profile.business.edit")}
          </button>
        )}
      </div>

      {load.status === "loading" && (
        <p role="status" className="py-6 font-sans text-sm text-ink-cacao/70">
          {t("profile.business.loading")}
        </p>
      )}

      {load.status === "failed" && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-4 border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
          <span>{t("profile.business.loadError")}</span>
          <button type="button" onClick={read} className="min-h-11 underline underline-offset-4 hover:text-pod-wine">
            {t("common.retry")}
          </button>
        </div>
      )}

      {load.status === "ready" && (
        <>
          {justSaved && !editing && (
            <p className="mt-4 flex items-center gap-2 font-sans text-sm text-ink-cacao">
              <CheckIcon size={16} className="text-canopy-green" />
              {t("profile.business.saved")}
            </p>
          )}

          {editing ? (
            <Form
              profile={load.profile}
              onCancel={() => setEditing(false)}
              onSaved={(profile) => {
                setLoad({ status: "ready", profile });
                updateUser({ companyName: profile.companyName, verificationStatus: profile.verificationStatus });
                setJustSaved(true);
                setEditing(false);
              }}
            />
          ) : (
            <dl className="grid gap-x-10 gap-y-6 py-6 sm:grid-cols-2">
              {(
                [
                  ["profile.business.company", load.profile.companyName],
                  ["profile.business.taxId", load.profile.taxId],
                  ["profile.business.industry", load.profile.industry],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="font-sans text-xs font-semibold uppercase tracking-wider text-ink-cacao">{t(label)}</dt>
                  <dd className="mt-1 border-b border-ink-cacao/40 py-2 font-sans text-sm text-ink-cacao">{value || <span className="text-ink-cacao/70">{t("profile.business.none")}</span>}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="border-t border-ink-cacao/20 py-5">
            <p className="font-sans text-xs font-semibold uppercase tracking-wider text-ink-cacao">{t("profile.business.verification")}</p>
            <p className="mt-2 font-sans text-sm font-medium text-ink-cacao">{t(`profile.business.status.${load.profile.verificationStatus}`)}</p>
            <p className="mt-1 font-sans text-xs text-ink-cacao/70">{t(`profile.business.statusNote.${load.profile.verificationStatus}`)}</p>
          </div>
        </>
      )}
    </section>
  );
}
