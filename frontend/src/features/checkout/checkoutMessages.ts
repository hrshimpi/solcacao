// What to tell a person when an order could not be placed, in their language. The server explains a problem with a code, and
// the text for each code lives here (and in the dictionaries). Nothing was charged and no order was made in any of these cases.
import type { TFunction } from "i18next";
import { ApiError } from "../../lib/apiFetch";

export type CheckoutField = "name" | "number" | "expiry" | "cvc" | "address";

export interface CheckoutProblem {
  // a message for each field the server named
  fields: Partial<Record<CheckoutField, string>>;
  // a message for the whole page, when no field is to blame
  form?: string;
  // the cart is not as it was: the page and the cart read it again
  reload?: boolean;
  // there is nothing to buy any more
  empty?: boolean;
}

// the names of the fields in the body of the server (the fields of the card come as "payment.cardNumber" or "cardNumber")
const fieldOf: Record<string, CheckoutField> = { cardNumber: "number", expiry: "expiry", cvc: "cvc", nameOnCard: "name", addressId: "address" };

export function checkoutProblem(error: unknown, t: TFunction): CheckoutProblem {
  if (error instanceof ApiError) {
    if (error.code === "CARD_DECLINED") return { fields: { number: t("checkout.errors.declined") } };
    if (error.code === "INSUFFICIENT_FUNDS") return { fields: { number: t("checkout.errors.noFunds") } };
    if (error.code === "CART_EMPTY") return { fields: {}, empty: true };
    if (error.code === "CART_CHANGED") return { fields: {}, form: t("checkout.errors.cartChanged"), reload: true };
    if (error.code === "INSUFFICIENT_STOCK") return { fields: {}, form: t("checkout.errors.stock"), reload: true };
    if (error.code === "RATE_LIMITED" || error.status === 429) return { fields: {}, form: t("checkout.errors.tooMany") };
    if (error.status === 0) return { fields: {}, form: t("checkout.errors.network") };

    if (error.code === "VALIDATION_ERROR") {
      const fields: CheckoutProblem["fields"] = {};
      for (const detail of error.details) {
        const field = detail.field ? fieldOf[detail.field.replace(/^payment\./, "")] : undefined;
        if (!field || fields[field]) continue;
        fields[field] =
          field === "number" ? t("checkout.errors.cardNumber") : field === "expiry" ? t("checkout.errors.expiry") : field === "cvc" ? t("checkout.errors.cvc") : field === "address" ? t("checkout.address.required") : t("errors.required");
      }
      if (Object.keys(fields).length > 0) return { fields };
    }
  }
  return { fields: {}, form: t("checkout.errors.unknown") };
}
