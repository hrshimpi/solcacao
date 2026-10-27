// Sends the emails of the site with Nodemailer. Every function returns true or false and never throws,
// so a broken mail server can slow nothing down more than the timeouts below and can never fail a request.
//
// With SMTP_HOST empty (development and tests) nothing is sent: Nodemailer's JSON transport only builds
// the message, and we log who it was for, the subject and the text, so you can see what would go out.
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.ts";
import { logger } from "../logger.ts";
import {
  inquiryEmail,
  isValidAddress,
  newsletterWelcomeEmail,
  quoteEmail,
  type InquiryMailData,
  type MailContent,
  type MailRecipient,
  type QuoteMailData,
} from "./mail-templates.ts";

export interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  toSupport: string;
  toWholesale: string;
  // the address of the website, for the buttons in the emails
  siteUrl: string;
}

export interface MailLogger {
  info(fields: object, message: string): void;
  error(fields: object, message: string): void;
}

interface Message extends MailContent {
  to: string;
  replyTo?: string;
}

export function buildTransport(config: Pick<MailConfig, "host" | "port" | "user" | "pass">): Transporter {
  if (config.host.trim() === "") {
    return nodemailer.createTransport({ jsonTransport: true });
  }
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // port 465 is SMTP over TLS from the start, the other ports upgrade the connection when they can
    secure: config.port === 465,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    // a mail server that does not answer must not keep a request waiting for long
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

export function createMailService(options: { config: MailConfig; log: MailLogger; transport?: Transporter }) {
  const { config, log } = options;
  const transport = options.transport ?? buildTransport(config);
  const onlyLogging = config.host.trim() === "";

  // builds the message, sends it and answers true or false. Nothing escapes this function as an error.
  async function deliver(kind: string, prepare: () => Message): Promise<boolean> {
    try {
      const message = prepare();
      await transport.sendMail({ from: config.from, ...message });
      if (onlyLogging) {
        log.info({ kind, to: message.to, subject: message.subject, text: message.text }, "email not sent, SMTP_HOST is empty");
      }
      return true;
    } catch (error) {
      // only the error message is logged, never the inquiry, the request or the address that was used
      log.error({ kind, error: error instanceof Error ? error.message : "unknown error" }, "could not send email");
      return false;
    }
  }

  return {
    // to the wholesale team for wholesale inquiries, to support for everything else
    sendInquiryEmail(inquiry: InquiryMailData): Promise<boolean> {
      return deliver("inquiry", () => ({
        to: inquiry.category === "wholesale" ? config.toWholesale : config.toSupport,
        // so the team answers the person by pressing reply
        replyTo: isValidAddress(inquiry.email) ? inquiry.email : undefined,
        ...inquiryEmail(inquiry),
      }));
    },

    // to the customer, when their quote request has been answered
    sendQuoteNotification(request: QuoteMailData, user: MailRecipient): Promise<boolean> {
      return deliver("quote", () => {
        if (!isValidAddress(user.email)) throw new Error("the user has no valid email address");
        return { to: user.email, ...quoteEmail(request, user, { siteUrl: config.siteUrl }) };
      });
    },

    // to the person who just subscribed, in English or Spanish
    sendNewsletterWelcome(email: string, lang: string): Promise<boolean> {
      return deliver("newsletter", () => {
        if (!isValidAddress(email)) throw new Error("the newsletter address is not valid");
        return { to: email, ...newsletterWelcomeEmail(email, lang, { siteUrl: config.siteUrl }) };
      });
    },
  };
}

const mail = createMailService({
  config: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.MAIL_FROM,
    toSupport: env.MAIL_TO_SUPPORT,
    toWholesale: env.MAIL_TO_WHOLESALE,
    siteUrl: env.CLIENT_ORIGIN,
  },
  log: logger,
});

export const { sendInquiryEmail, sendQuoteNotification, sendNewsletterWelcome } = mail;
