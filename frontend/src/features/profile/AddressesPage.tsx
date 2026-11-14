// The shipping addresses of a signed in person: a list with the default one marked, and add, change, delete (after asking)
// and make default. After every change the list is read again, so the default is always the one the server says.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "../../i18n/LanguageContext";
import { api } from "../../lib/api";
import { ApiError } from "../../lib/apiFetch";
import { usePageTitle } from "../../lib/usePageTitle";
import { CheckIcon } from "../../ui/Icons";
import { useAnnounce } from "../../ui/LiveRegion";
import LocaleLink from "../../ui/LocaleLink";
import AddressForm, { type Address } from "./components/AddressForm";

type Load = { status: "loading" } | { status: "failed" } | { status: "ready"; addresses: Address[] };

// what is shown for an address the server sent: anything that is not in the shape we know is left out
function readAddresses(body: unknown): Address[] | null {
  const list = typeof body === "object" && body !== null ? (body as { addresses?: unknown }).addresses : undefined;
  if (!Array.isArray(list)) return null;
  return list.flatMap((item): Address[] => {
    if (typeof item !== "object" || item === null) return [];
    const entry = item as Record<string, unknown>;
    const text = (value: unknown) => (typeof value === "string" ? value : null);
    const [id, label, street, city, state, postalCode, country] = [entry.id, entry.label, entry.street, entry.city, entry.state, entry.postalCode, entry.country].map(text);
    if (!id || !label || !street || !city || !state || !postalCode || !country) return [];
    return [{ id, label, street, ...(text(entry.street2) ? { street2: text(entry.street2)! } : {}), city, state, postalCode, country, isDefault: entry.isDefault === true }];
  });
}

const MAX_ADDRESSES = 10;

export default function AddressesPage() {
  const { t, lang } = useLang();
  const announce = useAnnounce();
  usePageTitle(t("titles.addresses"));

  const [load, setLoad] = useState<Load>({ status: "loading" });
  // the form that is open: "new", the address that is changed, or nothing
  const [form, setForm] = useState<"new" | Address | null>(null);
  // the address that is being asked about before it is deleted
  const [asking, setAsking] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const addButton = useRef<HTMLButtonElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);

  const read = useCallback(
    (signal?: AbortSignal) => {
      return api
        .get<unknown>("/users/me/addresses", { lang, signal })
        .then((body) => {
          const addresses = readAddresses(body);
          setLoad(addresses ? { status: "ready", addresses } : { status: "failed" });
        })
        .catch(() => {
          if (!signal?.aborted) setLoad({ status: "failed" });
        });
    },
    [lang],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    void read(controller.signal);
    return () => controller.abort();
  }, [read]);

  useEffect(() => {
    if (problem) problemRef.current?.focus();
  }, [problem]);

  const addresses = load.status === "ready" ? load.addresses : [];

  function closeForm(message?: string) {
    setForm(null);
    if (message) announce(message);
    // the form is gone, so the keyboard goes back to a button that is still there
    requestAnimationFrame(() => addButton.current?.focus());
  }

  async function remove(address: Address) {
    setProblem("");
    try {
      await api.delete(`/users/me/addresses/${address.id}`, { lang });
      setAsking(null);
      announce(t("addresses.deleted"));
      await read();
      requestAnimationFrame(() => addButton.current?.focus());
    } catch (error) {
      setProblem(error instanceof ApiError && error.status === 0 ? t("addresses.errors.network") : t("addresses.errors.delete"));
    }
  }

  async function makeDefault(address: Address) {
    setProblem("");
    try {
      await api.post(`/users/me/addresses/${address.id}/default`, { lang });
      announce(t("addresses.defaultSet", { label: address.label }));
      await read();
    } catch (error) {
      setProblem(error instanceof ApiError && error.status === 0 ? t("addresses.errors.network") : t("addresses.errors.default"));
    }
  }

  const buttonClass = "min-h-11 border border-ink-cacao px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-clay-surface";

  return (
    <div className="bg-stone-paper">
      <div className="border-b border-ink-cacao">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14">
          <p className="mb-3 font-sans text-[11px] uppercase tracking-[0.18em] text-pod-wine">{t("addresses.eyebrow")}</p>
          <h1 className="font-spectral text-4xl font-semibold tracking-tight text-ink-cacao md:text-5xl">{t("addresses.title")}</h1>
          <p className="mt-3 max-w-xl font-spectral text-ink-cacao/70">{t("addresses.intro")}</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14">
        <LocaleLink to="/profile" className="mb-8 inline-flex min-h-11 items-center font-sans text-sm text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
          {t("addresses.back")}
        </LocaleLink>

        {problem && (
          <div ref={problemRef} role="alert" tabIndex={-1} className="mb-6 border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
            {problem}
          </div>
        )}

        {load.status === "loading" && (
          <p role="status" className="font-sans text-sm text-ink-cacao/70">
            {t("addresses.loading")}
          </p>
        )}

        {load.status === "failed" && (
          <div role="alert" className="flex flex-wrap items-center gap-4 border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
            <span>{t("addresses.loadError")}</span>
            <button
              type="button"
              onClick={() => {
                setLoad({ status: "loading" });
                void read();
              }}
              className="min-h-11 underline underline-offset-4 hover:text-pod-wine"
            >
              {t("common.retry")}
            </button>
          </div>
        )}

        {load.status === "ready" && (
          <>
            {addresses.length === 0 && form === null && <p className="border border-ink-cacao/30 p-6 font-spectral text-ink-cacao">{t("addresses.empty")}</p>}

            <ul className="space-y-4">
              {addresses.map((address) =>
                form !== null && form !== "new" && form.id === address.id ? (
                  <li key={address.id}>
                    <AddressForm
                      address={address}
                      onCancel={() => closeForm()}
                      onSaved={async () => {
                        await read();
                        closeForm(t("addresses.saved"));
                      }}
                    />
                  </li>
                ) : (
                  <li key={address.id} className="border border-ink-cacao/30 p-5 sm:p-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-spectral text-xl font-semibold text-ink-cacao">{address.label}</h2>
                      {address.isDefault && (
                        <span className="inline-flex items-center gap-1 bg-ink-cacao px-2 py-1 font-sans text-[11px] uppercase tracking-wider text-paper-text">
                          <CheckIcon size={12} />
                          {t("addresses.default")}
                        </span>
                      )}
                    </div>
                    <address className="mt-3 font-sans text-sm not-italic leading-relaxed text-ink-cacao">
                      {address.street}
                      <br />
                      {address.street2 && (
                        <>
                          {address.street2}
                          <br />
                        </>
                      )}
                      {address.city}, {address.state} {address.postalCode}
                      <br />
                      {address.country}
                    </address>

                    {asking === address.id ? (
                      <div role="group" aria-label={t("addresses.deleteNamed", { label: address.label })} className="mt-4 border-t border-ink-cacao/20 pt-4">
                        <p className="font-sans text-sm text-ink-cacao">{t("addresses.deleteConfirm", { label: address.label })}</p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          <button type="button" onClick={() => remove(address)} className="min-h-11 bg-pod-wine px-4 py-2 font-sans text-xs font-medium text-paper-text hover:bg-ink-cacao">
                            {t("addresses.deleteYes")}
                          </button>
                          <button type="button" onClick={() => setAsking(null)} className={buttonClass}>
                            {t("addresses.deleteNo")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-3 border-t border-ink-cacao/20 pt-4">
                        <button type="button" onClick={() => setForm(address)} aria-label={t("addresses.editNamed", { label: address.label })} className={buttonClass}>
                          {t("addresses.edit")}
                        </button>
                        {!address.isDefault && (
                          <button type="button" onClick={() => makeDefault(address)} aria-label={t("addresses.makeDefaultNamed", { label: address.label })} className={buttonClass}>
                            {t("addresses.makeDefault")}
                          </button>
                        )}
                        <button type="button" onClick={() => setAsking(address.id)} aria-label={t("addresses.deleteNamed", { label: address.label })} className={buttonClass}>
                          {t("addresses.delete")}
                        </button>
                      </div>
                    )}
                  </li>
                ),
              )}
            </ul>

            {form === "new" ? (
              <div className="mt-6">
                <AddressForm
                  onCancel={() => closeForm()}
                  onSaved={async () => {
                    await read();
                    closeForm(t("addresses.saved"));
                  }}
                />
              </div>
            ) : (
              <div className="mt-6">
                {addresses.length >= MAX_ADDRESSES ? (
                  <p className="font-sans text-sm text-ink-cacao/70">{t("addresses.limit")}</p>
                ) : (
                  <button
                    ref={addButton}
                    type="button"
                    onClick={() => {
                      setProblem("");
                      setForm("new");
                    }}
                    className="min-h-11 bg-sun-gold px-7 py-3 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/85"
                  >
                    {t("addresses.add")}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
