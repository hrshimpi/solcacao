// The checkout, for a signed in person (the route sends everybody else to sign in, and then back here). Where to send the
// order, how fast, and how to pay are three steps on one page, with the order summary beside them. The prices and the
// totals are the ones of the server. The payment is made up: nobody is charged (the card fields say so).
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { fetchCheckout, placeOrder, type Checkout, type ShippingMethod } from "../../api/orders";
import { useLang } from "../../i18n/LanguageContext";
import { useForm } from "../../lib/useForm";
import { usePageTitle } from "../../lib/usePageTitle";
import { cardCvc, cardExpiry, cardNumber, maxLength, minLength, required } from "../../lib/validation";
import { useAnnounce } from "../../ui/LiveRegion";
import LocaleLink from "../../ui/LocaleLink";
import PageLoading from "../../ui/PageLoading";
import TextField from "../../ui/TextField";
import { useCart } from "../cart/CartContext";
import { formatCardNumber, formatExpiry, digitsOnly } from "./card";
import { checkoutProblem } from "./checkoutMessages";
import AddressStep from "./components/AddressStep";
import DeliveryStep from "./components/DeliveryStep";
import OrderSummary from "./components/OrderSummary";
import StepHeading from "./components/StepHeading";

type Load = { status: "loading" } | { status: "failed" } | { status: "ready"; checkout: Checkout };

export default function CheckoutPage() {
  const { t, lang, path } = useLang();
  const navigate = useNavigate();
  const announce = useAnnounce();
  const cart = useCart();
  usePageTitle(t("titles.checkout"));

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [shipping, setShipping] = useState<ShippingMethod>("standard");
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addressError, setAddressError] = useState("");
  const [problem, setProblem] = useState("");
  const [empty, setEmpty] = useState(false);
  const problemRef = useRef<HTMLDivElement>(null);

  // what the server holds: the cart, how it can be shipped and the tax. Read again after a problem with the cart.
  useEffect(() => {
    const controller = new AbortController();
    setLoad((current) => (current.status === "ready" ? current : { status: "loading" }));
    fetchCheckout({ lang, signal: controller.signal })
      .then((checkout) => setLoad({ status: "ready", checkout }))
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: "failed" });
      });
    return () => controller.abort();
  }, [lang, attempt]);

  useEffect(() => {
    if (problem) problemRef.current?.focus();
  }, [problem]);

  const form = useForm({
    initial: { name: "", number: "", expiry: "", cvc: "", note: "" },
    rules: {
      name: [required, minLength(2), maxLength(80)],
      number: [required, cardNumber],
      expiry: [required, cardExpiry()],
      cvc: [required, cardCvc],
      note: [maxLength(300)],
    },
    onSubmit: async (values) => {
      setProblem("");
      if (!addressId) {
        setAddressError(t("checkout.address.required"));
        document.getElementById("checkout-address")?.scrollIntoView?.();
        return;
      }
      if (load.status !== "ready" || !load.checkout.ready) return;

      try {
        const order = await placeOrder(
          { addressId, shippingMethod: shipping, cardNumber: digitsOnly(values.number), expiry: values.expiry, cvc: values.cvc, nameOnCard: values.name.trim(), note: values.note.trim() || undefined },
          { lang },
        );
        // the server emptied the cart: the cart of the page reads it again
        cart.retry();
        announce(t("checkout.announce"));
        navigate(path(`/account/orders/${order.id}`), { state: { placed: true } });
      } catch (error) {
        const found = checkoutProblem(error, t);
        if (found.empty) setEmpty(true);
        if (found.fields.address) setAddressError(found.fields.address);
        // the address is not a field of this form: its problem is shown with the addresses
        const cardFields = { ...found.fields };
        delete cardFields.address;
        if (Object.keys(cardFields).length > 0) form.setFieldErrors(cardFields);
        if (found.form) setProblem(found.form);
        if (found.reload) {
          cart.retry();
          setAttempt((count) => count + 1);
        }
      }
    },
  });

  if (load.status === "loading") return <PageLoading label={t("checkout.loading")} />;

  if (load.status === "failed") {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 bg-stone-paper px-4 text-center">
        <p role="alert" className="font-spectral text-xl text-ink-cacao">
          {t("checkout.loadError")}
        </p>
        <button type="button" onClick={() => setAttempt((count) => count + 1)} className="min-h-11 border border-ink-cacao px-5 font-sans text-sm text-ink-cacao hover:bg-ink-cacao hover:text-stone-paper">
          {t("common.retry")}
        </button>
      </div>
    );
  }

  const { checkout } = load;

  if (empty || checkout.cart.lines.length === 0) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 bg-stone-paper px-4 text-center">
        <h1 className="font-spectral text-3xl font-semibold text-ink-cacao">{t("checkout.emptyTitle")}</h1>
        <p className="max-w-md font-spectral text-ink-cacao/70">{t("checkout.emptyBody")}</p>
        <LocaleLink to="/shop" className="inline-flex min-h-11 items-center bg-sun-gold px-8 py-3 font-sans text-sm font-medium text-ink-cacao hover:bg-sun-gold/90">
          {t("checkout.emptyLink")}
        </LocaleLink>
      </div>
    );
  }

  const numberField = form.field("number");
  const expiryField = form.field("expiry");

  return (
    <div className="bg-stone-paper">
      <div className="border-b border-ink-cacao">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
          <p className="mb-3 font-sans text-[11px] uppercase tracking-[0.18em] text-pod-wine">{t("checkout.eyebrow")}</p>
          <h1 className="font-spectral text-4xl font-semibold tracking-tight text-ink-cacao md:text-5xl">{t("checkout.title")}</h1>
          <p className="mt-3 max-w-xl font-spectral text-ink-cacao/70">{t("checkout.intro")}</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        <p className="mb-8 border-l-4 border-sun-gold bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">{t("checkout.demoBanner")}</p>

        {problem && (
          <div ref={problemRef} role="alert" tabIndex={-1} className="mb-8 border-l-4 border-pod-wine bg-clay-surface px-4 py-3 font-sans text-sm text-ink-cacao">
            {problem}
          </div>
        )}

        <div className="grid gap-12 lg:grid-cols-[3fr_2fr] lg:gap-16">
          <div className="space-y-12">
            <AddressStep
              selected={addressId}
              error={addressError}
              onSelect={(id) => {
                setAddressId(id);
                setAddressError("");
              }}
            />

            <DeliveryStep options={checkout.shippingOptions} value={shipping} onChange={setShipping} />

            {/* the form of the card is the form of the page: the address form above is a form too, and forms cannot be inside each other. The place order button is in the summary, and belongs to this form with its form attribute. */}
            <form id="checkout-form" ref={form.formRef} onSubmit={form.handleSubmit} noValidate aria-busy={form.submitting}>
              <section aria-labelledby="checkout-payment">
                <StepHeading id="checkout-payment" number={3} title={t("checkout.payment.title")} />
                <p className="mb-6 border-l-4 border-sun-gold bg-clay-surface px-4 py-3 font-sans text-xs leading-relaxed text-ink-cacao">{t("checkout.payment.demo")}</p>
                <p className="mb-4 font-sans text-xs text-ink-cacao/70">{t("common.requiredNote")}</p>

                <div className="space-y-6">
                  <TextField label={t("checkout.payment.name")} autoComplete="cc-name" required {...form.field("name")} />
                  <TextField
                    label={t("checkout.payment.number")}
                    autoComplete="cc-number"
                    inputMode="numeric"
                    required
                    placeholder="4242 4242 4242 4242"
                    {...numberField}
                    onChange={(value) => numberField.onChange(formatCardNumber(value))}
                  />
                  <div className="grid gap-6 sm:grid-cols-2">
                    <TextField
                      label={t("checkout.payment.expiry")}
                      hint={t("checkout.payment.expiryHint")}
                      autoComplete="cc-exp"
                      inputMode="numeric"
                      required
                      placeholder="12/30"
                      {...expiryField}
                      onChange={(value) => expiryField.onChange(formatExpiry(value))}
                    />
                    <TextField label={t("checkout.payment.cvc")} autoComplete="cc-csc" inputMode="numeric" maxLength={4} required placeholder="123" {...form.field("cvc")} />
                  </div>
                  <TextField label={t("checkout.payment.note")} hint={t("checkout.payment.noteHint")} multiline rows={3} {...form.field("note")} />
                </div>
              </section>
            </form>
          </div>

          <OrderSummary checkout={checkout} shipping={shipping} busy={form.submitting} />
        </div>
      </div>
    </div>
  );
}
