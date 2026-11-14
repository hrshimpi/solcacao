// The payment, made up for the demo. Nobody is charged: this stands where a real payment service (Stripe, for example)
// would stand, and answers the way one does, so the rest of the shop is written for the real thing.
// It checks the card like a real one would (the number has to pass the Luhn check, the card must not be out of date, the
// security code has the right length), and a few test numbers are refused on purpose, to show what the shop does then:
//   4242 4242 4242 4242   works (any other good number works too)
//   4000 0000 0000 0002   the card is declined
//   4000 0000 0000 9995   not enough money on the card
// The number of the card is never kept. The caller keeps the brand, the last four digits and the reference.
import { randomBytes } from "node:crypto";

export type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "card";

export interface CardInput {
  // digits only
  number: string;
  expMonth: number;
  // four digits
  expYear: number;
  cvc: string;
  name: string;
}

export type ChargeFailure = "invalid_card" | "expired_card" | "invalid_cvc" | "card_declined" | "insufficient_funds";

export type ChargeResult = { ok: true; reference: string; brand: CardBrand; last4: string } | { ok: false; reason: ChargeFailure };

export interface PaymentGateway {
  // amount in whole cents
  charge(request: { amount: number; card: CardInput }): Promise<ChargeResult>;
  // gives the money back (nothing to do in the demo, a real service would be called here)
  refund(reference: string): Promise<{ ok: true }>;
}

// the check digit that every real card number has
export function passesLuhn(number: string): boolean {
  if (!/^\d{12,19}$/.test(number)) return false;
  let sum = 0;
  for (let index = 0; index < number.length; index++) {
    let digit = Number(number[number.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function brandOf(number: string): CardBrand {
  if (/^4/.test(number)) return "visa";
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(number)) return "mastercard";
  if (/^3[47]/.test(number)) return "amex";
  if (/^(6011|65|64[4-9])/.test(number)) return "discover";
  return "card";
}

const declinedNumbers: Record<string, ChargeFailure> = {
  "4000000000000002": "card_declined",
  "4000000000009995": "insufficient_funds",
};

export function createDemoGateway({ now = () => new Date(), makeReference = () => randomBytes(8).toString("hex") }: { now?: () => Date; makeReference?: () => string } = {}): PaymentGateway {
  return {
    async charge({ amount, card }) {
      if (!Number.isInteger(amount) || amount <= 0 || !passesLuhn(card.number)) return { ok: false, reason: "invalid_card" };

      const today = now();
      const outOfDate = card.expYear < today.getUTCFullYear() || (card.expYear === today.getUTCFullYear() && card.expMonth < today.getUTCMonth() + 1);
      if (outOfDate || card.expMonth < 1 || card.expMonth > 12) return { ok: false, reason: "expired_card" };

      const brand = brandOf(card.number);
      if (!new RegExp(`^\\d{${brand === "amex" ? 4 : 3}}$`).test(card.cvc)) return { ok: false, reason: "invalid_cvc" };

      const refused = declinedNumbers[card.number];
      if (refused) return { ok: false, reason: refused };

      return { ok: true, reference: `demo_${makeReference()}`, brand, last4: card.number.slice(-4) };
    },

    async refund() {
      return { ok: true };
    },
  };
}
