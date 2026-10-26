import nodemailer from "nodemailer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTransport, createMailService, type MailConfig } from "./mail.service.ts";
import type { InquiryMailData, QuoteReadyMailData, QuoteRequestMailData } from "./mail-templates.ts";

const config: MailConfig = {
  host: "",
  port: 587,
  user: "",
  pass: "",
  from: "SolCacao <no-reply@solcacao.example>",
  toSupport: "support@solcacao.example",
  toWholesale: "wholesale@solcacao.example",
  siteUrl: "https://solcacao.example",
};

const inquiry: InquiryMailData = {
  category: "general",
  name: "Isabel Vasquez",
  email: "isabel@example.com",
  message: "Do you ship the Ecuador bar to Canada?",
};

const request: QuoteReadyMailData = {
  companyName: "Hacienda Brands",
  cacaoProfile: "Ecuador",
  packagingType: "foil_wrap",
  quantityEstimate: 800,
  quoteAmount: 125000,
  quoteNote: "Includes the foil printing.",
};

const user = { email: "isabel@example.com", name: "Isabel" };

const quoteRequest: QuoteRequestMailData = {
  companyName: "Hacienda Brands",
  contactName: "Isabel Vasquez",
  cacaoProfile: "Ecuador",
  packagingType: "foil_wrap",
  quantityEstimate: 800,
  notes: "Before the holidays, please.",
  brandAssets: [{ originalName: "logo.png", sizeBytes: 20480 }],
};

// a mail service that uses Nodemailer's JSON transport: it builds the messages but sends nothing
function setup(overrides: Partial<MailConfig> = {}) {
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const sendMail = vi.spyOn(transport, "sendMail");
  const log = { info: vi.fn(), error: vi.fn() };
  const service = createMailService({ config: { ...config, ...overrides }, log, transport });

  // the messages that were "sent", as the JSON transport wrote them down
  async function sent() {
    const infos = await Promise.all(sendMail.mock.results.map((result) => result.value));
    return infos.map((info) => JSON.parse(info.message));
  }

  return { service, transport, sendMail, log, sent };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("dotenv/config");
  vi.resetModules();
});

describe("sendInquiryEmail: who gets it", () => {
  it.each([
    ["general", "support@solcacao.example"],
    ["support", "support@solcacao.example"],
    ["feedback", "support@solcacao.example"],
    ["newsletter", "support@solcacao.example"],
    ["wholesale", "wholesale@solcacao.example"],
  ] as const)("a %s inquiry goes to %s", async (category, recipient) => {
    const { service, sent } = setup();

    expect(await service.sendInquiryEmail({ ...inquiry, category })).toBe(true);

    const [message] = await sent();
    expect(message.to).toEqual([{ address: recipient, name: "" }]);
  });

  it("uses the addresses from the settings", async () => {
    const { service, sent } = setup({ toSupport: "help@shop.example", toWholesale: "b2b@shop.example" });

    await service.sendInquiryEmail(inquiry);
    await service.sendInquiryEmail({ ...inquiry, category: "wholesale" });

    const messages = await sent();
    expect(messages.map((message) => message.to[0].address)).toEqual(["help@shop.example", "b2b@shop.example"]);
  });

  it("comes from the MAIL_FROM address", async () => {
    const { service, sent } = setup();

    await service.sendInquiryEmail(inquiry);

    const [message] = await sent();
    expect(message.from).toEqual({ address: "no-reply@solcacao.example", name: "SolCacao" });
  });

  it("can be answered by replying, because the reply goes to the person", async () => {
    const { service, sent } = setup();

    await service.sendInquiryEmail(inquiry);

    const [message] = await sent();
    expect(message.replyTo).toEqual([{ address: "isabel@example.com", name: "" }]);
  });

  it("has no reply address when the person gave no usable email", async () => {
    const { service, sent } = setup();

    await service.sendInquiryEmail({ category: "feedback", rating: 5 });
    await service.sendInquiryEmail({ ...inquiry, email: "not an email" });

    const messages = await sent();
    expect(messages).toHaveLength(2);
    for (const message of messages) expect(message.replyTo ?? null).toBeNull();
  });
});

describe("sendInquiryEmail: what is in it", () => {
  it.each([
    [{ ...inquiry, category: "general" as const }, "New general inquiry from Isabel Vasquez"],
    [{ ...inquiry, category: "wholesale" as const }, "New wholesale inquiry from Isabel Vasquez"],
    [{ ...inquiry, category: "support" as const }, "New support request from Isabel Vasquez"],
    [{ category: "feedback" as const, rating: 3 }, "New feedback: 3 out of 5"],
    [{ category: "newsletter" as const, email: "isabel@example.com" }, "New newsletter sign up"],
  ])("has the subject for %j", async (data, subject) => {
    const { service, sent } = setup();

    await service.sendInquiryEmail(data);

    expect((await sent())[0].subject).toBe(subject);
  });

  it("sends both an html and a text version", async () => {
    const { service, sent } = setup();

    await service.sendInquiryEmail(inquiry);

    const [message] = await sent();
    expect(message.html).toContain("Do you ship the Ecuador bar to Canada?");
    expect(message.text).toContain("Do you ship the Ecuador bar to Canada?");
  });

  it("escapes a malicious name in the html and in the title", async () => {
    const { service, sent } = setup();

    await service.sendInquiryEmail({ ...inquiry, name: `<script>alert("x")</script>`, message: `<img src=x onerror=alert(1)>` });

    const [message] = await sent();
    expect(message.html).not.toContain("<script");
    expect(message.html).not.toContain("<img");
    expect(message.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(message.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("cannot be tricked into a second subject line or an extra recipient", async () => {
    const { service, sent } = setup();

    await service.sendInquiryEmail({ ...inquiry, name: "Isabel\r\nBcc: evil@example.com", email: "isabel@example.com\r\nBcc: evil@example.com" });

    const [message] = await sent();
    expect(message.subject).not.toMatch(/[\r\n]/);
    expect(message.to).toEqual([{ address: "support@solcacao.example", name: "" }]);
    expect(message.replyTo ?? null).toBeNull();
    expect(JSON.stringify(message.headers)).not.toContain("evil");
  });
});

describe("sendQuoteNotification (to the team)", () => {
  it("goes to the wholesale address, and replying answers the customer", async () => {
    const { service, sent } = setup();

    expect(await service.sendQuoteNotification(quoteRequest, user)).toBe(true);

    const [message] = await sent();
    expect(message.to).toEqual([{ address: "wholesale@solcacao.example", name: "" }]);
    expect(message.replyTo).toEqual([{ address: "isabel@example.com", name: "" }]);
    expect(message.subject).toBe("New quote request from Hacienda Brands");
    expect(message.html).toContain("Before the holidays, please.");
    expect(message.html).toContain("logo.png (20 KB)");
  });

  it("uses the address from the settings", async () => {
    const { service, sent } = setup({ toWholesale: "b2b@shop.example" });

    await service.sendQuoteNotification(quoteRequest, user);

    expect((await sent())[0].to[0].address).toBe("b2b@shop.example");
  });

  it("is still sent when the customer's email is not known, just without a reply address", async () => {
    const { service, sent } = setup();

    expect(await service.sendQuoteNotification(quoteRequest, { email: "" })).toBe(true);

    expect((await sent())[0].replyTo ?? null).toBeNull();
  });

  it("escapes what the customer typed", async () => {
    const { service, sent } = setup();

    await service.sendQuoteNotification({ ...quoteRequest, companyName: "<b>Evil</b> & Co", notes: "<script>x()</script>" }, user);

    const [message] = await sent();
    expect(message.html).not.toContain("<script");
    expect(message.html).not.toContain("<b>Evil");
    expect(message.html).toContain("&lt;b&gt;Evil&lt;/b&gt; &amp; Co");
  });

  it("returns false and logs only the error message when sending fails", async () => {
    const { service, sendMail, log } = setup();
    sendMail.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:587"));

    await expect(service.sendQuoteNotification(quoteRequest, user)).resolves.toBe(false);

    expect(log.error).toHaveBeenCalledWith({ kind: "quote", error: "connect ECONNREFUSED 127.0.0.1:587" }, "could not send email");
    expect(JSON.stringify(log.error.mock.calls)).not.toContain("Hacienda");
  });

  it("returns false for broken data instead of throwing", async () => {
    const { service } = setup();

    await expect(service.sendQuoteNotification(null as never, user)).resolves.toBe(false);
    await expect(service.sendQuoteNotification(quoteRequest, null as never)).resolves.toBe(false);
  });
});

describe("sendQuoteReady", () => {
  it("goes to the customer with the quote subject", async () => {
    const { service, sent } = setup();

    expect(await service.sendQuoteReady(request, user)).toBe(true);

    const [message] = await sent();
    expect(message.to).toEqual([{ address: "isabel@example.com", name: "" }]);
    expect(message.subject).toBe("Your SolCacao quote is ready");
    expect(message.html).toContain("$1,250.00");
    expect(message.html).toContain('href="https://solcacao.example"');
  });

  it("escapes the company, the note and the customer name", async () => {
    const { service, sent } = setup();

    await service.sendQuoteReady(
      { ...request, companyName: "<b>Evil</b> & Co", quoteNote: "<script>x()</script>" },
      { email: "isabel@example.com", name: `"><img src=x>` },
    );

    const [message] = await sent();
    expect(message.html).not.toContain("<script");
    expect(message.html).not.toContain("<img");
    expect(message.html).not.toContain("<b>Evil");
    expect(message.html).toContain("&lt;b&gt;Evil&lt;/b&gt; &amp; Co");
  });

  it("does not send to an address that is not valid", async () => {
    const { service, sendMail, log } = setup();

    expect(await service.sendQuoteReady(request, { email: "not an email" })).toBe(false);

    expect(sendMail).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledTimes(1);
  });
});

describe("sendNewsletterWelcome", () => {
  it("goes to the new subscriber in English", async () => {
    const { service, sent } = setup();

    expect(await service.sendNewsletterWelcome("isabel@example.com", "en")).toBe(true);

    const [message] = await sent();
    expect(message.to).toEqual([{ address: "isabel@example.com", name: "" }]);
    expect(message.subject).toBe("Welcome to SolCacao");
    expect(message.html).toContain('<html lang="en">');
  });

  it("goes to the new subscriber in Spanish", async () => {
    const { service, sent } = setup();

    await service.sendNewsletterWelcome("isabel@example.com", "es");

    const [message] = await sent();
    expect(message.subject).toBe("Te damos la bienvenida a SolCacao");
    expect(message.html).toContain('<html lang="es">');
    expect(message.html).toContain(`href="https://solcacao.example/es/shop"`);
  });

  it("does not send to an address that is not valid", async () => {
    const { service, sendMail } = setup();

    for (const email of ["", "isabel", "a@example.com, b@example.com", "isabel@example.com\r\nBcc: evil@example.com"]) {
      expect(await service.sendNewsletterWelcome(email, "en"), email).toBe(false);
    }
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("when sending fails", () => {
  const failure = new Error("connect ECONNREFUSED 127.0.0.1:587");

  function broken() {
    const parts = setup();
    parts.sendMail.mockRejectedValue(failure);
    return parts;
  }

  it("returns false and does not throw, for all three emails", async () => {
    const { service } = broken();

    await expect(service.sendInquiryEmail(inquiry)).resolves.toBe(false);
    await expect(service.sendQuoteReady(request, user)).resolves.toBe(false);
    await expect(service.sendNewsletterWelcome("isabel@example.com", "en")).resolves.toBe(false);
  });

  it("logs the error message and not what was in the email", async () => {
    const { service, log } = broken();

    await service.sendInquiryEmail({ ...inquiry, name: "Secret Name", message: "A private message about prices" });

    expect(log.error).toHaveBeenCalledTimes(1);
    const [fields, message] = log.error.mock.calls[0];
    expect(fields).toEqual({ kind: "inquiry", error: "connect ECONNREFUSED 127.0.0.1:587" });
    expect(message).toBe("could not send email");
    const everything = JSON.stringify(log.error.mock.calls);
    for (const secret of ["Secret Name", "private message", "isabel@example.com", "Isabel"]) {
      expect(everything).not.toContain(secret);
    }
  });

  it("logs which kind of email it was", async () => {
    const { service, log } = broken();

    await service.sendQuoteReady(request, user);
    await service.sendNewsletterWelcome("isabel@example.com", "es");

    expect(log.error.mock.calls.map(([fields]) => fields.kind)).toEqual(["quote-ready", "newsletter"]);
  });

  it("copes with things that are not Error objects", async () => {
    const { service, sendMail, log } = setup();
    sendMail.mockRejectedValue("just a string");

    await expect(service.sendInquiryEmail(inquiry)).resolves.toBe(false);

    expect(log.error.mock.calls[0][0]).toEqual({ kind: "inquiry", error: "unknown error" });
  });

  it("returns false when the data is broken, instead of crashing", async () => {
    const { service, sendMail, log } = setup();

    await expect(service.sendInquiryEmail(null as never)).resolves.toBe(false);
    await expect(service.sendInquiryEmail(undefined as never)).resolves.toBe(false);
    await expect(service.sendQuoteReady(null as never, user)).resolves.toBe(false);
    await expect(service.sendQuoteReady(request, null as never)).resolves.toBe(false);
    await expect(service.sendNewsletterWelcome(undefined as never, "en")).resolves.toBe(false);

    expect(sendMail).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledTimes(5);
  });

  it("works again after a failure", async () => {
    const { service, sendMail } = setup();
    sendMail.mockRejectedValueOnce(failure);

    expect(await service.sendInquiryEmail(inquiry)).toBe(false);
    expect(await service.sendInquiryEmail(inquiry)).toBe(true);
  });
});

describe("without an SMTP server", () => {
  it("logs the message instead of sending it, and still answers true", async () => {
    const { service, log } = setup({ host: "" });

    expect(await service.sendInquiryEmail({ ...inquiry, category: "wholesale" })).toBe(true);

    expect(log.error).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledTimes(1);
    const [fields, message] = log.info.mock.calls[0];
    expect(message).toBe("email not sent, SMTP_HOST is empty");
    expect(fields).toMatchObject({ kind: "inquiry", to: "wholesale@solcacao.example", subject: "New wholesale inquiry from Isabel Vasquez" });
    expect(fields.text).toContain("Do you ship the Ecuador bar to Canada?");
  });

  it("does not log anything when a real server is used", async () => {
    const { service, log } = setup({ host: "smtp.example.com" });

    expect(await service.sendNewsletterWelcome("isabel@example.com", "en")).toBe(true);

    expect(log.info).not.toHaveBeenCalled();
  });

  it("works with the settings from the environment, with no SMTP_HOST at all", async () => {
    vi.resetModules();
    vi.doMock("dotenv/config", () => ({}));
    vi.stubEnv("SMTP_HOST", undefined);
    vi.stubEnv("MAIL_TO_SUPPORT", undefined);
    vi.stubEnv("MAIL_TO_WHOLESALE", undefined);

    const mail = await import("./mail.service.ts");

    // no connection is made and no mail server is needed
    expect(await mail.sendInquiryEmail(inquiry)).toBe(true);
    expect(await mail.sendQuoteReady(request, user)).toBe(true);
    expect(await mail.sendNewsletterWelcome("isabel@example.com", "es")).toBe(true);
  });
});

describe("buildTransport", () => {
  it("uses the JSON transport when SMTP_HOST is empty", () => {
    expect(buildTransport({ host: "", port: 587, user: "", pass: "" }).transporter.name).toBe("JSONTransport");
    expect(buildTransport({ host: "   ", port: 587, user: "", pass: "" }).transporter.name).toBe("JSONTransport");
  });

  it("uses SMTP with the settings when there is a host", () => {
    const transport = buildTransport({ host: "smtp.example.com", port: 587, user: "me", pass: "secret" });

    expect(transport.transporter.name).toBe("SMTP");
    expect(transport.options).toMatchObject({ host: "smtp.example.com", port: 587, secure: false, auth: { user: "me", pass: "secret" } });
  });

  it("uses TLS from the start on port 465", () => {
    const transport = buildTransport({ host: "smtp.example.com", port: 465, user: "me", pass: "secret" });

    expect(transport.options).toMatchObject({ port: 465, secure: true });
  });

  it("sends without a login when there is no user", () => {
    const transport = buildTransport({ host: "localhost", port: 1025, user: "", pass: "" });

    expect((transport.options as { auth?: unknown }).auth).toBeUndefined();
  });

  it("gives up on a server that does not answer", () => {
    const transport = buildTransport({ host: "smtp.example.com", port: 587, user: "", pass: "" });

    expect(transport.options).toMatchObject({ connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 });
  });
});
