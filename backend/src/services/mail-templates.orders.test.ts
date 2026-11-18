import { describe, expect, it } from "vitest";
import { orderConfirmationEmail, orderShippedEmail, type OrderMailData } from "./mail-templates.ts";

const order: OrderMailData = {
  number: "SC-18293A4B",
  lines: [
    { kind: "product", quantity: 2, lineTotal: 2400, products: [{ name: "Ecuador 72%" }] },
    { kind: "sampler", quantity: 1, lineTotal: 4300, products: [{ name: "Ecuador 72%" }, { name: "Peru 68%" }, { name: "Venezuela 76%" }, { name: "Colombia 64%" }] },
  ],
  totals: { subtotal: 6700, shipping: 0, tax: 553, total: 7253 },
  shippingAddress: { fullName: "Isabel Vasquez", street: "4821 Sunrise Lane", street2: "Apt 12B", city: "Austin", state: "TX", postalCode: "78701", country: "United States" },
  shippingMethod: "standard",
  payment: { brand: "visa", last4: "4242" },
};
const options = { siteUrl: "https://solcacao.example.com/" };
const isabel = { email: "isabel@example.com", name: "Isabel" };

describe("the order confirmation email", () => {
  it("says what was bought, what it cost, where it goes and how it was paid, in English", () => {
    const mail = orderConfirmationEmail(order, isabel, "en", options);

    expect(mail.subject).toBe("Your SolCacao order SC-18293A4B");
    for (const text of [mail.text, mail.html]) {
      expect(text).toContain("2 x Ecuador 72%: $24.00");
      expect(text).toContain("Custom sampler (Ecuador 72%, Peru 68%, Venezuela 76%, Colombia 64%)");
      expect(text).toContain("$72.53");
      expect(text).toContain("Free");
      expect(text).toContain("4821 Sunrise Lane");
      expect(text).toContain("visa");
      expect(text).toContain("4242");
    }
    expect(mail.text).toContain("Hello Isabel,");
    expect(mail.text).toContain("nobody was charged");
  });

  it("is in Spanish for a Spanish account, and in English for anything else", () => {
    expect(orderConfirmationEmail(order, isabel, "es", options).subject).toBe("Tu pedido SC-18293A4B de SolCacao");
    expect(orderConfirmationEmail(order, isabel, "es", options).text).toContain("Muestrario personalizado");
    expect(orderConfirmationEmail(order, isabel, "fr", options).subject).toBe("Your SolCacao order SC-18293A4B");
  });

  it("links to the orders of the account in the language of the email, without a double slash", () => {
    expect(orderConfirmationEmail(order, isabel, "en", options).text).toContain("https://solcacao.example.com/en/account/orders");
    expect(orderConfirmationEmail(order, isabel, "es", options).text).toContain("https://solcacao.example.com/es/account/orders");
  });

  it("writes what a person typed as text, never as html", () => {
    const sneaky = { ...order, shippingAddress: { ...order.shippingAddress, fullName: "<script>alert(1)</script>" }, lines: [{ ...order.lines[0], products: [{ name: "<img src=x onerror=alert(1)>" }] }] };

    const mail = orderConfirmationEmail(sneaky, { email: "isabel@example.com", name: "<b>Isabel</b>" }, "en", options);

    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).not.toContain("<b>Isabel</b>");
  });
});

describe("the order shipped email", () => {
  it("says that the order is on its way, in both languages", () => {
    expect(orderShippedEmail(order, isabel, "en", options).subject).toBe("Your SolCacao order SC-18293A4B is on its way");
    expect(orderShippedEmail(order, isabel, "es", options).subject).toBe("Tu pedido SC-18293A4B de SolCacao va en camino");
    expect(orderShippedEmail(order, isabel, "en", options).text).toContain("handed to the carrier");
  });
});
