// Step 2 of the checkout: how fast. The prices come from the server (shipping is free from $60.00 of products).
import type { ShippingMethod, ShippingOption } from "../../../api/orders";
import { formatPrice } from "../../../i18n/format";
import { useLang } from "../../../i18n/LanguageContext";
import StepHeading from "./StepHeading";

interface DeliveryStepProps {
  options: ShippingOption[];
  value: ShippingMethod;
  onChange: (method: ShippingMethod) => void;
}

export default function DeliveryStep({ options, value, onChange }: DeliveryStepProps) {
  const { t, lang } = useLang();

  return (
    <section aria-labelledby="checkout-delivery">
      <StepHeading id="checkout-delivery" number={2} title={t("checkout.delivery.title")} />
      <fieldset>
        <legend className="sr-only">{t("checkout.delivery.title")}</legend>
        <ul className="space-y-3">
          {options.map((option) => (
            <li key={option.id}>
              {/* the label wraps the radio button, and its text is a few levels down, which the rule does not follow */}
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label
                className={`flex cursor-pointer items-center gap-4 border p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-pod-wine ${
                  value === option.id ? "border-ink-cacao bg-clay-surface" : "border-ink-cacao/30 hover:border-ink-cacao"
                }`}
              >
                <input type="radio" name="shipping-method" value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} className="h-4 w-4 accent-pod-wine" />
                <span className="flex flex-1 flex-wrap items-baseline justify-between gap-x-4">
                  <span>
                    <span className="block font-spectral text-lg font-semibold text-ink-cacao">{t(`checkout.delivery.${option.id}`)}</span>
                    <span className="block font-sans text-sm text-ink-cacao/70">{t(`checkout.delivery.${option.id}Days`)}</span>
                  </span>
                  <span className="font-sans text-sm font-medium text-ink-cacao">{option.price === 0 ? t("checkout.delivery.free") : formatPrice(option.price, lang)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    </section>
  );
}
