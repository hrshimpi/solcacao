import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  inquiryEmail,
  isValidAddress,
  newsletterWelcomeEmail,
  quoteReadyEmail,
  quoteRequestEmail,
  type InquiryMailData,
  type QuoteReadyMailData,
  type QuoteRequestMailData,
} from "./mail-templates.ts";

const siteUrl = "https://solcacao.example";

// the three long dash characters, written as code points so this file has none of them
const longDashes = new RegExp(`[${String.fromCodePoint(0x2013, 0x2014, 0x2212)}]`);

const attack = `<script>alert("x")</script><img src=x onerror=alert(1)>"'&`;

// every html tag name used in an email, so we can see whether typed text added a tag of its own
function tagNames(html: string): string[] {
  return [...new Set([...html.matchAll(/<\/?([a-z][a-z0-9]*)/gi)].map((match) => match[1].toLowerCase()))].sort();
}

const request: QuoteReadyMailData = {
  companyName: "Hacienda Brands",
  cacaoProfile: "Ecuador",
  packagingType: "rigid_box",
  quantityEstimate: 1200,
  quoteAmount: 125000,
  quoteNote: "Includes the foil printing.\nDelivery in six weeks.",
};

describe("escapeHtml", () => {
  it("escapes the characters that can start markup", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    expect(escapeHtml("`")).toBe("&#96;");
  });

  it("does not escape twice, and copes with empty values", () => {
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(42)).toBe("42");
  });
});

describe("isValidAddress", () => {
  it("accepts normal addresses", () => {
    expect(isValidAddress("isabel@example.com")).toBe(true);
    expect(isValidAddress("isabel.vasquez+cacao@mail.example.co")).toBe(true);
  });

  it.each(["", "isabel", "isabel@", "@example.com", "isabel@example", "a b@example.com", "a@example.com, b@example.com", "Isabel <a@example.com>", 'a"b@example.com', "a@example.com\r\nBcc: x@example.com", undefined, null, 42])(
    "refuses %j",
    (address) => {
      expect(isValidAddress(address)).toBe(false);
    },
  );
});

describe("inquiry email", () => {
  const full: InquiryMailData = { category: "general", name: "Isabel Vasquez", email: "isabel@example.com", message: "Do you ship to Canada?\nWe need 40 boxes." };

  it.each([
    [{ ...full, category: "general" as const }, "New general inquiry from Isabel Vasquez"],
    [{ ...full, category: "wholesale" as const }, "New wholesale inquiry from Isabel Vasquez"],
    [{ ...full, category: "support" as const }, "New support request from Isabel Vasquez"],
    [{ category: "feedback" as const, rating: 4 }, "New feedback: 4 out of 5"],
    [{ category: "feedback" as const }, "New feedback"],
    [{ category: "newsletter" as const, email: "isabel@example.com" }, "New newsletter sign up"],
  ])("has the subject for %j", (inquiry, subject) => {
    expect(inquiryEmail(inquiry).subject).toBe(subject);
  });

  it("falls back to the email, then to a visitor, when there is no name", () => {
    expect(inquiryEmail({ category: "support", email: "isabel@example.com" }).subject).toBe("New support request from isabel@example.com");
    expect(inquiryEmail({ category: "support" }).subject).toBe("New support request from a visitor");
  });

  it("shows the details and the message in the html and in the text", () => {
    const { html, text } = inquiryEmail(full);

    for (const part of ["Isabel Vasquez", "isabel@example.com", "General", "Do you ship to Canada?"]) {
      expect(html).toContain(part);
      expect(text).toContain(part);
    }
    expect(html).toContain("We need 40 boxes.");
    expect(html).toContain("Do you ship to Canada?<br>We need 40 boxes.");
    expect(text).toContain("> Do you ship to Canada?\n> We need 40 boxes.");
  });

  it("shows the rating for feedback", () => {
    const { html, text } = inquiryEmail({ category: "feedback", rating: 5, message: "Loved the Peru bar" });

    expect(html).toContain("5 out of 5");
    expect(text).toContain("Rating: 5 out of 5");
  });

  it("keeps a subject on one line, whatever the name contains", () => {
    const { subject } = inquiryEmail({ ...full, name: "Isabel\r\nBcc: evil@example.com\n\tSecond" });

    expect(subject).not.toMatch(/[\r\n\t]/);
    expect(subject).toBe("New general inquiry from Isabel Bcc: evil@example.com Second");
  });

  it("cuts a very long name in the subject", () => {
    const { subject } = inquiryEmail({ ...full, name: "x".repeat(500) });

    expect(subject.length).toBeLessThan(120);
    expect(subject).toContain("...");
  });

  describe("escaping what people typed", () => {
    const evil: InquiryMailData = { category: "wholesale", name: attack, email: "a@example.com", message: attack };

    it("turns the typed markup into plain text in the html", () => {
      const { html } = inquiryEmail(evil);

      expect(html).not.toContain("<script");
      expect(html).not.toContain("<img");
      expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
      expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
      expect(html).toContain("&amp;");
    });

    it("adds no tag that a normal message would not have", () => {
      const normal = inquiryEmail({ category: "wholesale", name: "Isabel", email: "a@example.com", message: "Hello there" });

      expect(tagNames(inquiryEmail(evil).html)).toEqual(tagNames(normal.html));
    });

    it("escapes the title and the subject copy in the html too", () => {
      const { html } = inquiryEmail(evil);

      expect(html).not.toMatch(/<title>[^<]*<script/);
      expect(html).toMatch(/<title>New wholesale inquiry from &lt;script&gt;/);
    });

    it("leaves the text version as typed, it is not html", () => {
      expect(inquiryEmail(evil).text).toContain(attack);
    });

    it("breaks out of nothing through a quote in an email address", () => {
      const { html } = inquiryEmail({ category: "general", name: "x", email: `a"onclick="alert(1)@example.com`, message: "hello hello" });

      expect(html).not.toContain(`href="mailto:a"onclick`);
      expect(html).not.toContain("onclick=\"alert");
    });
  });

  describe("reply button", () => {
    it("is a mailto link to a valid address", () => {
      expect(inquiryEmail(full).html).toContain('href="mailto:isabel@example.com"');
    });

    it("is left out when there is no usable address", () => {
      expect(inquiryEmail({ category: "support", message: "no email given" }).html).not.toContain("mailto:");
      expect(inquiryEmail({ category: "support", email: "not an email" }).html).not.toContain("mailto:");
    });
  });
});

const quoteRequest: QuoteRequestMailData = {
  companyName: "Hacienda Brands",
  contactName: "Isabel Vasquez",
  cacaoProfile: "Ecuador",
  packagingType: "specimen_card",
  quantityEstimate: 2500,
  notes: "We need it before the holidays.\nPlease call first.",
  brandAssets: [
    { originalName: "logo.png", sizeBytes: 20480 },
    { originalName: "label.pdf", sizeBytes: 3 * 1024 * 1024 },
  ],
};

describe("quote request email (for the team)", () => {
  const customer = { email: "isabel@example.com", name: "Isabel" };

  it("has a subject with the company and all the details in html and text", () => {
    const { subject, html, text } = quoteRequestEmail(quoteRequest, customer);

    expect(subject).toBe("New quote request from Hacienda Brands");
    for (const part of ["Hacienda Brands", "Isabel Vasquez", "isabel@example.com", "Ecuador", "Specimen card", "2,500", "We need it before the holidays."]) {
      expect(html, part).toContain(part);
      expect(text, part).toContain(part);
    }
    expect(html).toContain("We need it before the holidays.<br>Please call first.");
  });

  it("lists the brand files with their sizes, and says None when there are none", () => {
    const withFiles = quoteRequestEmail(quoteRequest, customer);
    const without = quoteRequestEmail({ ...quoteRequest, brandAssets: [] }, customer);

    expect(withFiles.text).toContain("Brand files: logo.png (20 KB), label.pdf (3 MB)");
    expect(without.text).toContain("Brand files: None");
  });

  it("has a button to reply to the customer, only for a usable address", () => {
    expect(quoteRequestEmail(quoteRequest, customer).html).toContain('href="mailto:isabel@example.com"');
    expect(quoteRequestEmail(quoteRequest, { email: "" }).html).not.toContain("mailto:");
    expect(quoteRequestEmail(quoteRequest, { email: "not an email" }).html).not.toContain("mailto:");
  });

  it("works without notes and without a known email", () => {
    const { html, text } = quoteRequestEmail({ ...quoteRequest, notes: undefined }, { email: "" });

    expect(html).not.toContain("border-left:4px");
    expect(text).not.toContain("Email:");
  });

  it("keeps the subject on one line and cuts a very long company name", () => {
    expect(quoteRequestEmail({ ...quoteRequest, companyName: "Hacienda\r\nBcc: evil@example.com" }, customer).subject).toBe("New quote request from Hacienda Bcc: evil@example.com");
    expect(quoteRequestEmail({ ...quoteRequest, companyName: "x".repeat(500) }, customer).subject.length).toBeLessThan(120);
  });

  it("escapes everything a person typed, including the names of the files", () => {
    const evil: QuoteRequestMailData = {
      ...quoteRequest,
      companyName: attack,
      contactName: attack,
      cacaoProfile: attack,
      notes: attack + "\n" + attack,
      brandAssets: [{ originalName: attack, sizeBytes: 10 }],
    };

    const { html } = quoteRequestEmail(evil, { email: "isabel@example.com", name: attack });

    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(tagNames(html)).toEqual(tagNames(quoteRequestEmail(quoteRequest, customer).html));
  });
});

describe("quote ready email", () => {
  const user = { email: "isabel@example.com", name: "Isabel" };

  it("has the subject and the quote details", () => {
    const { subject, html, text } = quoteReadyEmail(request, user, { siteUrl });

    expect(subject).toBe("Your SolCacao quote is ready");
    for (const part of ["Hello Isabel,", "Hacienda Brands", "Ecuador", "Rigid box", "1,200", "$1,250.00", "Includes the foil printing."]) {
      expect(html).toContain(part);
      expect(text).toContain(part);
    }
    expect(html).toContain("Includes the foil printing.<br>Delivery in six weeks.");
  });

  it("works without a name, a note or an amount", () => {
    const { html, text } = quoteReadyEmail({ ...request, quoteNote: undefined, quoteAmount: null }, { email: "isabel@example.com" }, { siteUrl });

    expect(text.startsWith("Your quote is ready")).toBe(true);
    expect(text).toContain("Hello,");
    expect(html).not.toContain("Quote</td>");
    expect(html).not.toContain("border-left:4px");
  });

  it("escapes the company, the name, the profile and the note", () => {
    const { html } = quoteReadyEmail(
      { ...request, companyName: attack, cacaoProfile: attack, quoteNote: attack + "\n" + attack },
      { email: "isabel@example.com", name: attack },
      { siteUrl },
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(tagNames(html)).toEqual(tagNames(quoteReadyEmail(request, user, { siteUrl }).html));
  });

  it("has a gold button to the site", () => {
    const { html, text } = quoteReadyEmail(request, user, { siteUrl });

    expect(html).toContain(`href="${siteUrl}"`);
    expect(html).toContain("#efa836");
    expect(text).toContain(`Open SolCacao: ${siteUrl}`);
  });
});

describe("newsletter welcome", () => {
  it("is in English", () => {
    const { subject, html, text } = newsletterWelcomeEmail("isabel@example.com", "en", { siteUrl });

    expect(subject).toBe("Welcome to SolCacao");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("Thanks for subscribing");
    expect(html).toContain("You signed up with isabel@example.com.");
    expect(html).toContain(`href="${siteUrl}/en/shop"`);
    expect(text).toContain("Visit the shop: https://solcacao.example/en/shop");
  });

  it("is in Spanish", () => {
    const { subject, html, text } = newsletterWelcomeEmail("isabel@example.com", "es", { siteUrl });

    expect(subject).toBe("Te damos la bienvenida a SolCacao");
    expect(html).toContain('<html lang="es">');
    expect(html).toContain("Gracias por suscribirte");
    expect(html).toContain("Te suscribiste con isabel@example.com.");
    expect(html).toContain(`href="${siteUrl}/es/shop"`);
    expect(text).toContain("Ver la tienda: https://solcacao.example/es/shop");
  });

  it("uses English for any other language", () => {
    for (const lang of ["fr", "", "EN", "es-MX", "<script>"]) {
      expect(newsletterWelcomeEmail("isabel@example.com", lang, { siteUrl }).subject, lang).toBe("Welcome to SolCacao");
    }
  });

  it("does not repeat the slash when the site address ends with one", () => {
    expect(newsletterWelcomeEmail("isabel@example.com", "en", { siteUrl: `${siteUrl}/` }).html).toContain(`href="${siteUrl}/en/shop"`);
  });

  it("escapes the address", () => {
    const { html } = newsletterWelcomeEmail(`"><script>alert(1)</script>@example.com`, "en", { siteUrl });

    expect(html).not.toContain("<script");
    expect(tagNames(html)).toEqual(tagNames(newsletterWelcomeEmail("isabel@example.com", "en", { siteUrl }).html));
  });
});

describe("how the emails look", () => {
  const all = [
    inquiryEmail({ category: "wholesale", name: "Isabel", email: "isabel@example.com", message: "Hello there" }),
    quoteReadyEmail(request, { email: "isabel@example.com", name: "Isabel" }, { siteUrl }),
    quoteRequestEmail(quoteRequest, { email: "isabel@example.com", name: "Isabel" }),
    newsletterWelcomeEmail("isabel@example.com", "en", { siteUrl }),
    newsletterWelcomeEmail("isabel@example.com", "es", { siteUrl }),
  ];

  it("uses the brand colours with inline styles", () => {
    for (const { html } of all) {
      expect(html).toContain("#1c1310");
      expect(html).toContain("#efa836");
      expect(html).toContain('style="');
      expect(html).not.toContain("<style");
      expect(html).not.toContain("<link");
    }
  });

  it("has no images, scripts or emojis, and no long dashes", () => {
    for (const { subject, html, text } of all) {
      for (const part of [subject, html, text]) {
        expect(part).not.toMatch(/<img|<script|<svg|<iframe/i);
        expect(part).not.toMatch(/\p{Extended_Pictographic}/u);
        expect(part).not.toMatch(longDashes);
      }
    }
  });

  it("is a complete page with a language, a title and a text version", () => {
    for (const { subject, html, text } of all) {
      expect(html.startsWith("<!doctype html>")).toBe(true);
      expect(html).toMatch(/<html lang="(en|es)">/);
      expect(html).toContain(`<title>${escapeHtml(subject)}</title>`);
      expect(text.length).toBeGreaterThan(40);
      expect(text).not.toMatch(/<[a-z]/i);
    }
  });
});

describe("links in buttons", () => {
  it("leaves out a button whose address is not a web or mail link", () => {
    const { html, text } = quoteReadyEmail(request, { email: "isabel@example.com" }, { siteUrl: "javascript:alert(1)" });

    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("Open SolCacao");
    expect(text).not.toContain("javascript:");
  });
});
