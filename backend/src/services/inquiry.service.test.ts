import { describe, expect, it, vi } from "vitest";
import { AppError } from "../errors/AppError.ts";
import { createMemoryInquiryStore } from "../test/memoryInquiryStore.ts";
import { createInquiryService, type InquiryMail } from "./inquiry.service.ts";
import { DuplicateInquiryError, type InquiryStore } from "./inquiry.store.ts";

function setup(overrides: { store?: InquiryStore; mail?: Partial<InquiryMail> } = {}) {
  const memory = createMemoryInquiryStore();
  const mail = {
    sendInquiryEmail: vi.fn(async () => true),
    sendNewsletterWelcome: vi.fn(async () => true),
    ...overrides.mail,
  };
  const service = createInquiryService({ store: overrides.store ?? memory, mail });
  return { service, store: memory, mail };
}

const lang = { lang: "en" };

describe("submit: messages", () => {
  it.each(["general", "wholesale", "support"] as const)("saves a %s message and emails the team about it", async (category) => {
    const { service, store, mail } = setup();

    const { id } = await service.submit(
      { category, name: "Isabel Vasquez", email: "isabel@example.com", message: "Do you ship to Canada?" },
      lang,
    );

    expect(store.all()).toEqual([expect.objectContaining({ id, category, name: "Isabel Vasquez", status: "new" })]);
    expect(mail.sendInquiryEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendInquiryEmail).toHaveBeenCalledWith({
      category,
      name: "Isabel Vasquez",
      email: "isabel@example.com",
      message: "Do you ship to Canada?",
      rating: undefined,
    });
    expect(mail.sendNewsletterWelcome).not.toHaveBeenCalled();
  });

  it("saves feedback with its rating and emails about it", async () => {
    const { service, store, mail } = setup();

    await service.submit({ category: "feedback", rating: 5, message: "Lovely" }, lang);

    expect(store.all()[0]).toMatchObject({ category: "feedback", rating: 5, message: "Lovely" });
    expect(mail.sendInquiryEmail).toHaveBeenCalledWith(expect.objectContaining({ category: "feedback", rating: 5 }));
  });

  it("keeps the user id of a signed in user", async () => {
    const { service, store } = setup();

    await service.submit({ category: "general", name: "Isabel", email: "isabel@example.com", message: "Hello there, friend" }, { ...lang, userId: "64b7f0c2a1b2c3d4e5f60718" });

    expect(store.all()[0].userId).toBe("64b7f0c2a1b2c3d4e5f60718");
  });

  it("does not need to wait for the email", async () => {
    let finishMail: () => void = () => {};
    const { service, store } = setup({ mail: { sendInquiryEmail: () => new Promise<boolean>((resolve) => (finishMail = () => resolve(true))) } });

    const { id } = await service.submit({ category: "general", name: "Isabel", email: "isabel@example.com", message: "Hello there, friend" }, lang);

    expect(id).toBe(store.all()[0].id);
    finishMail();
  });

  it("is still saved and answered when the email fails in any way", async () => {
    const failures: Partial<InquiryMail>[] = [
      { sendInquiryEmail: async () => false },
      { sendInquiryEmail: async () => Promise.reject(new Error("smtp is down")) },
      {
        sendInquiryEmail: () => {
          throw new Error("broken mock");
        },
      },
    ];

    for (const mail of failures) {
      const { service, store } = setup({ mail });

      await expect(service.submit({ category: "support", name: "Isabel", email: "isabel@example.com", message: "Hello there, friend" }, lang)).resolves.toEqual({
        id: expect.any(String),
      });
      expect(store.all()).toHaveLength(1);
    }
  });

  it("does not answer success when it could not save", async () => {
    const { service, mail } = setup({
      store: { ...createMemoryInquiryStore(), create: async () => Promise.reject(new AppError("DATABASE_UNAVAILABLE", 503, "down")) },
    });

    await expect(service.submit({ category: "general", name: "Isabel", email: "isabel@example.com", message: "Hello there, friend" }, lang)).rejects.toMatchObject({
      status: 503,
    });
    expect(mail.sendInquiryEmail).not.toHaveBeenCalled();
  });
});

describe("submit: newsletter", () => {
  it("saves the address and sends the welcome in the visitor's language", async () => {
    const { service, store, mail } = setup();

    const { id } = await service.submit({ category: "newsletter", email: "isabel@example.com" }, { lang: "es" });

    expect(store.all()).toEqual([expect.objectContaining({ id, category: "newsletter", email: "isabel@example.com" })]);
    expect(mail.sendNewsletterWelcome).toHaveBeenCalledWith("isabel@example.com", "es");
    expect(mail.sendInquiryEmail).not.toHaveBeenCalled();
  });

  it("gives the same answer to an address that is already subscribed, without a second record or email", async () => {
    const { service, store, mail } = setup();
    const first = await service.submit({ category: "newsletter", email: "isabel@example.com" }, lang);

    const second = await service.submit({ category: "newsletter", email: "isabel@example.com" }, lang);

    expect(second).toEqual(first);
    expect(store.all()).toHaveLength(1);
    expect(mail.sendNewsletterWelcome).toHaveBeenCalledTimes(1);
  });

  it("copes with two sign ups at the same moment", async () => {
    const memory = createMemoryInquiryStore();
    const winner = await memory.create({ category: "newsletter", email: "isabel@example.com" });
    // the check finds nothing (the other request was not saved yet), then saving finds the other one
    let checks = 0;
    const racing: InquiryStore = {
      ...memory,
      findNewsletter: async (email) => (checks++ === 0 ? null : memory.findNewsletter(email)),
      create: async () => Promise.reject(new DuplicateInquiryError()),
    };
    const { service, mail } = setup({ store: racing });

    const answer = await service.submit({ category: "newsletter", email: "isabel@example.com" }, lang);

    expect(answer).toEqual({ id: winner.id });
    expect(mail.sendNewsletterWelcome).not.toHaveBeenCalled();
  });

  it("passes on other errors from saving", async () => {
    const { service } = setup({ store: { ...createMemoryInquiryStore(), create: async () => Promise.reject(new Error("disk full")) } });

    await expect(service.submit({ category: "newsletter", email: "isabel@example.com" }, lang)).rejects.toThrow("disk full");
  });

  it("keeps the user id of a signed in subscriber", async () => {
    const { service, store } = setup();

    await service.submit({ category: "newsletter", email: "isabel@example.com" }, { ...lang, userId: "64b7f0c2a1b2c3d4e5f60718" });

    expect(store.all()[0].userId).toBe("64b7f0c2a1b2c3d4e5f60718");
  });
});

describe("list and setStatus", () => {
  it("returns the page the way the API shows it", async () => {
    const { service, store } = setup();
    for (let i = 0; i < 3; i++) await store.create({ category: "general", name: `Name ${i}`, email: "a@example.com", message: "A message here" });

    const result = await service.list({ page: 2, limit: 2 });

    expect(result).toMatchObject({ page: 2, limit: 2, total: 3 });
    expect(result.items).toHaveLength(1);
  });

  it("changes a status", async () => {
    const { service, store } = setup();
    const saved = await store.create({ category: "general", name: "Isabel", email: "a@example.com", message: "A message here" });

    expect(await service.setStatus(saved.id, "responded")).toMatchObject({ id: saved.id, status: "responded" });
  });

  it("says 404 for an inquiry that does not exist", async () => {
    const { service } = setup();

    await expect(service.setStatus("64b7f0c2a1b2c3d4e5f60718", "responded")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});
