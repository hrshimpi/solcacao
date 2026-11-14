// Step 1 of the checkout: where to send the order. The saved addresses are real radio buttons (the default one is chosen to
// begin with), and a new address can be added without leaving the page: it is saved to the account like any address.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "../../../i18n/LanguageContext";
import { api } from "../../../lib/api";
import LocaleLink from "../../../ui/LocaleLink";
import AddressForm, { type Address } from "../../profile/components/AddressForm";
import { readAddresses } from "../../profile/readAddresses";
import StepHeading from "./StepHeading";

interface AddressStepProps {
  selected: string | null;
  onSelect: (id: string) => void;
  error: string;
}

type Load = { status: "loading" } | { status: "failed" } | { status: "ready"; addresses: Address[] };

export default function AddressStep({ selected, onSelect, error }: AddressStepProps) {
  const { t, lang } = useLang();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);

  const read = useCallback(
    async (signal?: AbortSignal): Promise<Address[] | null> => {
      try {
        const addresses = readAddresses(await api.get<unknown>("/users/me/addresses", { lang, signal }));
        setLoad(addresses ? { status: "ready", addresses } : { status: "failed" });
        return addresses;
      } catch {
        if (!signal?.aborted) setLoad({ status: "failed" });
        return null;
      }
    },
    [lang],
  );

  useEffect(() => {
    const controller = new AbortController();
    void read(controller.signal).then((addresses) => {
      // the default address is where the order goes unless the person chooses another
      if (addresses && addresses.length > 0 && !controller.signal.aborted) onSelect((addresses.find((address) => address.isDefault) ?? addresses[0]).id);
    });
    return () => controller.abort();
    // only when the page opens, or the language changes
  }, [read]);

  const addresses = load.status === "ready" ? load.addresses : [];
  // a person with no address has nothing to choose, so the form is already open
  const formOpen = adding || (load.status === "ready" && addresses.length === 0);

  return (
    <section aria-labelledby="checkout-address">
      <StepHeading id="checkout-address" number={1} title={t("checkout.address.title")} />

      {load.status === "loading" && (
        <p role="status" className="font-sans text-sm text-ink-cacao/70">
          {t("addresses.loading")}
        </p>
      )}

      {load.status === "failed" && (
        <div role="alert" className="flex flex-wrap items-center gap-4 border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
          <span>{t("checkout.address.loadError")}</span>
          <button type="button" onClick={() => void read()} className="min-h-11 underline underline-offset-4 hover:text-pod-wine">
            {t("common.retry")}
          </button>
        </div>
      )}

      {load.status === "ready" && addresses.length === 0 && !adding && <p className="mb-4 font-spectral text-ink-cacao">{t("checkout.address.none")}</p>}

      {addresses.length > 0 && (
        <fieldset aria-describedby={error ? "checkout-address-error" : undefined}>
          <legend className="sr-only">{t("checkout.address.title")}</legend>
          <ul className="space-y-3">
            {addresses.map((address) => (
              <li key={address.id}>
                {/* the label wraps the radio button, and its text is a few levels down, which the rule does not follow */}
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label
                  className={`flex cursor-pointer items-start gap-4 border p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-pod-wine ${
                    selected === address.id ? "border-ink-cacao bg-clay-surface" : "border-ink-cacao/30 hover:border-ink-cacao"
                  }`}
                >
                  <input type="radio" name="shipping-address" value={address.id} checked={selected === address.id} onChange={() => onSelect(address.id)} className="mt-1.5 h-4 w-4 accent-pod-wine" />
                  <span className="block">
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="font-spectral text-lg font-semibold text-ink-cacao">{address.label}</span>
                      {address.isDefault && <span className="bg-ink-cacao px-2 py-0.5 font-sans text-[11px] uppercase tracking-wider text-paper-text">{t("checkout.address.default")}</span>}
                    </span>
                    <span className="mt-1 block font-sans text-sm leading-relaxed text-ink-cacao/80">
                      {address.street}
                      {address.street2 ? `, ${address.street2}` : ""}
                      <br />
                      {address.city}, {address.state} {address.postalCode}
                      <br />
                      {address.country}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {error && (
        <p id="checkout-address-error" role="alert" className="mt-3 font-sans text-sm text-pod-wine">
          {error}
        </p>
      )}

      {load.status === "ready" && formOpen && (
        <div className="mt-4">
          <AddressForm
            onCancel={() => {
              setAdding(false);
              requestAnimationFrame(() => addButton.current?.focus());
            }}
            onSaved={async (saved) => {
              await read();
              onSelect(saved.id);
              setAdding(false);
            }}
          />
        </div>
      )}

      {load.status === "ready" && !formOpen && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <button ref={addButton} type="button" onClick={() => setAdding(true)} className="min-h-11 border border-ink-cacao px-4 py-2 font-sans text-xs font-medium text-ink-cacao hover:bg-clay-surface">
            {t("checkout.address.add")}
          </button>
          <LocaleLink to="/profile/addresses" className="inline-flex min-h-11 items-center font-sans text-xs text-ink-cacao underline underline-offset-4 hover:text-pod-wine">
            {t("checkout.address.manage")}
          </LocaleLink>
        </div>
      )}
    </section>
  );
}
