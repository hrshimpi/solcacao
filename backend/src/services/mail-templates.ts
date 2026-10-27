// The email templates. Each one is a small function that returns { subject, html, text }.
// The html is plain on purpose: inline styles in the brand colours, no images and no emojis.
// A template describes its email as a few blocks (paragraph, details, quote, button). One function turns
// the blocks into html and into text, and that is the only place that writes html, so every value a person
// typed is escaped in one spot.
import type { B2BRequestData } from "../models/b2b-request.model.ts";

export interface MailContent {
  subject: string;
  html: string;
  text: string;
}

export type MailLang = "en" | "es";

// the same five categories as the Inquiry model
export type InquiryCategoryName = "general" | "wholesale" | "support" | "feedback" | "newsletter";

export interface InquiryMailData {
  category: InquiryCategoryName;
  name?: string;
  email?: string;
  message?: string;
  rating?: number;
}

// what the customer's "your quote is ready" email needs
export type QuoteReadyMailData = Pick<
  B2BRequestData,
  "companyName" | "cacaoProfile" | "packagingType" | "quantityEstimate" | "quoteAmount" | "quoteNote"
>;

// what the team's "new quote request" email needs, with the brand files as names and sizes only
export type QuoteRequestMailData = Pick<
  B2BRequestData,
  "companyName" | "contactName" | "cacaoProfile" | "packagingType" | "quantityEstimate" | "notes"
> & { brandAssets: { originalName: string; sizeBytes: number }[] };

export interface MailRecipient {
  email: string;
  name?: string;
}

interface TemplateOptions {
  // the address of the website, used for the buttons
  siteUrl: string;
}

const colors = {
  ink: "#1c1310",
  paper: "#f0ede4",
  clay: "#e3d9c6",
  gold: "#efa836",
  wine: "#6b1f2e",
};

const entities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"'`]/g, (character) => entities[character]);
}

// text that is safe to put in a subject line: one line, no control characters, not too long
function oneLine(value: unknown, max = 80): string {
  const line = String(value ?? "")
    .replace(/\p{Cc}+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return line.length > max ? `${line.slice(0, max - 3)}...` : line;
}

// a plain address like name@example.com, nothing that could add a second recipient or a header
const addressPattern = /^[^\s@<>",;:()[\]\\]+@[^\s@<>",;:()[\]\\]+\.[^\s@<>",;:()[\]\\]+$/;

export function isValidAddress(address: unknown): address is string {
  return typeof address === "string" && address.length <= 254 && addressPattern.test(address);
}

type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "details"; rows: [label: string, value: string][] }
  | { kind: "quote"; text: string }
  | { kind: "button"; label: string; url: string };

interface EmailParts {
  lang: MailLang;
  subject: string;
  heading: string;
  blocks: Block[];
  footer: string;
}

// only web and mail links become buttons, anything else (like javascript:) is left out
function isSafeLink(url: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(url) && !/[\s"'<>]/.test(url);
}

function blockToHtml(block: Block): string {
  switch (block.kind) {
    case "paragraph":
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${colors.ink};">${escapeHtml(block.text)}</p>`;
    case "details": {
      const rows = block.rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:8px 16px 8px 0;border-bottom:1px solid ${colors.clay};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${colors.wine};vertical-align:top;">${escapeHtml(label)}</td>` +
            `<td style="padding:8px 0;border-bottom:1px solid ${colors.clay};font-size:15px;color:${colors.ink};">${escapeHtml(value)}</td></tr>`,
        )
        .join("");
      return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px;">${rows}</table>`;
    }
    case "quote":
      return `<div style="margin:0 0 20px;padding:14px 16px;background:${colors.paper};border-left:4px solid ${colors.wine};font-size:15px;line-height:1.6;color:${colors.ink};">${escapeHtml(block.text).replace(/\r?\n/g, "<br>")}</div>`;
    case "button":
      if (!isSafeLink(block.url)) return "";
      return `<p style="margin:24px 0 8px;"><a href="${escapeHtml(block.url)}" style="display:inline-block;padding:12px 28px;background:${colors.gold};color:${colors.ink};font-size:15px;font-weight:bold;text-decoration:none;">${escapeHtml(block.label)}</a></p>`;
  }
}

function blockToText(block: Block): string {
  switch (block.kind) {
    case "paragraph":
      return block.text;
    case "details":
      return block.rows.map(([label, value]) => `${label}: ${value}`).join("\n");
    case "quote":
      return block.text
        .split(/\r?\n/)
        .map((line) => `> ${line}`)
        .join("\n");
    case "button":
      return isSafeLink(block.url) ? `${block.label}: ${block.url}` : "";
  }
}

function render({ lang, subject, heading, blocks, footer }: EmailParts): MailContent {
  const html =
    `<!doctype html>` +
    `<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:24px 12px;background:${colors.paper};font-family:Arial,Helvetica,sans-serif;color:${colors.ink};">` +
    `<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${colors.ink};">` +
    `<div style="padding:18px 28px;border-bottom:1px solid ${colors.ink};font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:${colors.ink};">SolCacao</div>` +
    `<div style="padding:28px;">` +
    `<h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:${colors.ink};">${escapeHtml(heading)}</h1>` +
    blocks.map(blockToHtml).join("") +
    `</div>` +
    `<div style="padding:16px 28px;background:${colors.clay};font-size:12px;line-height:1.5;color:${colors.ink};">${escapeHtml(footer)}</div>` +
    `</div></body></html>`;

  const text = [heading, ...blocks.map(blockToText).filter((part) => part !== ""), footer].join("\n\n");

  return { subject, html, text };
}

const categoryLabels: Record<InquiryCategoryName, string> = {
  general: "General",
  wholesale: "Wholesale",
  support: "Support",
  feedback: "Feedback",
  newsletter: "Newsletter",
};

// the email the team gets when someone writes through the site
export function inquiryEmail(inquiry: InquiryMailData): MailContent {
  const who = oneLine(inquiry.name) || oneLine(inquiry.email) || "a visitor";

  const subjects: Record<InquiryCategoryName, string> = {
    general: `New general inquiry from ${who}`,
    wholesale: `New wholesale inquiry from ${who}`,
    support: `New support request from ${who}`,
    feedback: inquiry.rating === undefined ? "New feedback" : `New feedback: ${oneLine(inquiry.rating, 10)} out of 5`,
    newsletter: "New newsletter sign up",
  };
  const subject = subjects[inquiry.category] ?? "New message from the website";

  const rows: [string, string][] = [["Category", categoryLabels[inquiry.category] ?? oneLine(inquiry.category, 20)]];
  if (inquiry.name) rows.push(["Name", inquiry.name]);
  if (inquiry.email) rows.push(["Email", inquiry.email]);
  if (inquiry.rating !== undefined) rows.push(["Rating", `${inquiry.rating} out of 5`]);

  const blocks: Block[] = [{ kind: "details", rows }];
  if (inquiry.message) blocks.push({ kind: "quote", text: inquiry.message });
  if (isValidAddress(inquiry.email)) {
    blocks.push({ kind: "button", label: "Reply by email", url: `mailto:${inquiry.email}` });
  }

  return render({
    lang: "en",
    subject,
    heading: subject,
    blocks,
    footer: "Sent from the SolCacao website. Replying to this email answers the person directly.",
  });
}

const packagingLabels: Record<string, string> = {
  foil_wrap: "Foil wrap",
  rigid_box: "Rigid box",
  specimen_card: "Specimen card",
  paper_sleeve: "Paper sleeve",
};

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// the email the team gets when a business sends a quote request
export function quoteRequestEmail(request: QuoteRequestMailData, user: MailRecipient): MailContent {
  const subject = `New quote request from ${oneLine(request.companyName) || "a business"}`;

  const files = request.brandAssets.map((asset) => `${oneLine(asset.originalName, 60)} (${formatSize(asset.sizeBytes)})`);
  const rows: [string, string][] = [
    ["Company", request.companyName],
    ["Contact", request.contactName],
  ];
  if (user.email) rows.push(["Email", user.email]);
  rows.push(
    ["Cacao profile", request.cacaoProfile],
    ["Packaging", packagingLabels[request.packagingType] ?? request.packagingType],
    ["Estimated units", request.quantityEstimate.toLocaleString("en-US")],
    ["Brand files", files.length > 0 ? files.join(", ") : "None"],
  );

  const blocks: Block[] = [{ kind: "details", rows }];
  if (request.notes) blocks.push({ kind: "quote", text: request.notes });
  if (isValidAddress(user.email)) blocks.push({ kind: "button", label: "Reply by email", url: `mailto:${user.email}` });

  return render({
    lang: "en",
    subject,
    heading: subject,
    blocks,
    footer: "Sent from the SolCacao website. Replying to this email answers the customer directly.",
  });
}

// the email a customer gets when their quote request has been answered
export function quoteReadyEmail(request: QuoteReadyMailData, user: MailRecipient, options: TemplateOptions): MailContent {
  const rows: [string, string][] = [
    ["Company", request.companyName],
    ["Cacao profile", request.cacaoProfile],
    ["Packaging", packagingLabels[request.packagingType] ?? request.packagingType],
    ["Estimated units", request.quantityEstimate.toLocaleString("en-US")],
  ];
  if (request.quoteAmount !== null && request.quoteAmount !== undefined) {
    rows.push(["Quote", formatMoney(request.quoteAmount)]);
  }

  const blocks: Block[] = [
    { kind: "paragraph", text: user.name ? `Hello ${user.name},` : "Hello," },
    { kind: "paragraph", text: `Thank you for your request. There is an answer for ${request.companyName}.` },
    { kind: "details", rows },
  ];
  if (request.quoteNote) blocks.push({ kind: "quote", text: request.quoteNote });
  blocks.push({ kind: "button", label: "Open SolCacao", url: options.siteUrl });

  return render({
    lang: "en",
    subject: "Your SolCacao quote is ready",
    heading: "Your quote is ready",
    blocks,
    footer: "You are receiving this email because you sent a quote request on SolCacao.",
  });
}

const welcomeText: Record<MailLang, { subject: string; heading: string; thanks: string; promise: string; button: string; footer: string }> = {
  en: {
    subject: "Welcome to SolCacao",
    heading: "Thanks for subscribing",
    thanks: "You signed up with",
    promise: "Now and then we will send you field notes, new harvests and limited releases.",
    button: "Visit the shop",
    footer: "You are receiving this email because this address was added to the SolCacao newsletter.",
  },
  es: {
    subject: "Te damos la bienvenida a SolCacao",
    heading: "Gracias por suscribirte",
    thanks: "Te suscribiste con",
    promise: "De vez en cuando te enviaremos notas de campo, nuevas cosechas y lanzamientos limitados.",
    button: "Ver la tienda",
    footer: "Recibes este correo porque esta dirección se agregó al boletín de SolCacao.",
  },
};

// the welcome after a newsletter sign up, in English or Spanish (anything else gets English)
export function newsletterWelcomeEmail(email: string, lang: string, options: TemplateOptions): MailContent {
  const language: MailLang = lang === "es" ? "es" : "en";
  const words = welcomeText[language];

  return render({
    lang: language,
    subject: words.subject,
    heading: words.heading,
    blocks: [
      { kind: "paragraph", text: `${words.thanks} ${email}.` },
      { kind: "paragraph", text: words.promise },
      { kind: "button", label: words.button, url: `${options.siteUrl.replace(/\/+$/, "")}/${language}/shop` },
    ],
    footer: words.footer,
  });
}
