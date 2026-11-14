// A stand-in for the backend, for the tests of pages that sign people in and read their account. It answers the way the real
// API does (the same paths, the same status codes and error codes), keeps its accounts in memory, and remembers every call
// so a test can look at what the page sent. Install it with installFakeServer(): it replaces fetch for the test.
// Everything it does not know answers 404 in the standard error shape.
import type { Lang } from "../i18n";
import { fixtureId, fixtureRecords, wireProduct, type FixtureRecord } from "./productFixtures";

export interface FakeAccount {
  id: string;
  email: string;
  password: string;
  name: string;
  accountType: "retail" | "b2b";
  role?: "user" | "admin";
  phone?: string;
  preferredLanguage?: "en" | "es";
  marketingEmails?: boolean;
  // for a business account
  companyName?: string;
  taxId?: string;
  industry?: string;
  verificationStatus?: "pending" | "verified" | "rejected";
}

export interface FakeAddress {
  id: string;
  label: string;
  street: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface FakeCall {
  method: string;
  path: string;
  // the body of the call, read as JSON when it was
  body: unknown;
  headers: Record<string, string>;
}

// a line of a cart, as the fake server keeps it (the price is in cents)
export interface FakeCartLine {
  lineId: string;
  kind: "product" | "sampler";
  productIds: string[];
  quantity: number;
  unitPrice: number;
}

// a short text that is the same for the same input, in the shape of a cart line id
function tinyHash(text: string): string {
  let hash = 5381;
  let other = 52711;
  for (const character of text) {
    hash = (hash * 33 + character.charCodeAt(0)) >>> 0;
    other = (other * 31 + character.charCodeAt(0)) >>> 0;
  }
  return (hash.toString(16).padStart(8, "0") + other.toString(16).padStart(8, "0") + (hash ^ other).toString(16).padStart(8, "0")).slice(0, 20);
}

export const retailAccount: FakeAccount = { id: "64b7f0c2a1b2c3d4e5f60718", email: "isabel@example.com", password: "correct horse 42", name: "Isabel Vasquez", accountType: "retail" };
export const businessAccount: FakeAccount = {
  id: "64b7f0c2a1b2c3d4e5f60719",
  email: "isabel@hacienda.example",
  password: "correct horse 42",
  name: "Isabel Vasquez",
  accountType: "b2b",
  companyName: "Hacienda Brands",
  verificationStatus: "pending",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const failure = (status: number, code: string, message: string, details: unknown[] = []) => json({ error: { code, message, details } }, status);
const noContent = () => new Response(null, { status: 204 });

export class FakeServer {
  accounts: FakeAccount[];
  addresses: FakeAddress[] = [];
  calls: FakeCall[] = [];
  // the account of the refresh cookie: who the server would sign in again
  cookieOf: FakeAccount | null = null;
  // the account the current access token belongs to
  tokenOf: FakeAccount | null = null;
  // reset tokens that the server knows (a test adds one to try the link)
  resetTokens = new Set<string>();
  private tokenCount = 0;
  private addressCount = 0;
  // a test can make a path answer in its own way: return a Response, or undefined to let the fake answer
  override: ((call: FakeCall) => Response | undefined) | null = null;

  constructor(accounts: FakeAccount[] = [retailAccount, businessAccount]) {
    this.accounts = accounts.map((account) => ({ ...account }));
  }

  // the browser comes back with the cookie of this account, so the first thing the page asks is answered with a sign in
  withCookieOf(account: FakeAccount): this {
    this.cookieOf = this.accounts.find((entry) => entry.email === account.email) ?? account;
    return this;
  }

  callsTo(method: string, path: string): FakeCall[] {
    return this.calls.filter((call) => call.method === method && call.path === path);
  }

  // a user as the server sends them
  serverUser(account: FakeAccount) {
    return {
      id: account.id,
      email: account.email,
      name: account.name,
      role: account.role ?? "user",
      accountType: account.accountType,
      ...(account.phone ? { phone: account.phone } : {}),
      preferredLanguage: account.preferredLanguage ?? "en",
      marketingEmails: account.marketingEmails ?? false,
      createdAt: "2026-06-15T12:00:00.000Z",
    };
  }

  private profileOf(account: FakeAccount) {
    return account.accountType === "b2b"
      ? { userId: account.id, companyName: account.companyName ?? "", taxId: account.taxId, industry: account.industry, verificationStatus: account.verificationStatus ?? "pending" }
      : null;
  }

  private session(account: FakeAccount, status = 200): Response {
    this.cookieOf = account;
    this.tokenOf = account;
    return json({ user: this.serverUser(account), accessToken: `token-${++this.tokenCount}`, expiresIn: 900 }, status);
  }

  private signedIn(call: FakeCall): FakeAccount | Response {
    if (!call.headers.authorization) return failure(401, "UNAUTHENTICATED", "Please sign in to do that.");
    return this.tokenOf ?? failure(401, "TOKEN_EXPIRED", "Your session ran out. Please sign in again.");
  }

  handle = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input), "http://localhost");
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([name, value]) => [name.toLowerCase(), value]));
    let body: unknown;
    try {
      body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    } catch {
      body = init?.body;
    }
    const call: FakeCall = { method: (init?.method ?? "GET").toUpperCase(), path: url.pathname + url.search, body, headers };
    this.calls.push(call);

    return this.override?.(call) ?? this.route(call, url.pathname) ?? failure(404, "NOT_FOUND", "That endpoint doesn't exist.");
  };

  private route(call: FakeCall, path: string): Response | undefined {
    const { method } = call;
    const input = (typeof call.body === "object" && call.body !== null ? call.body : {}) as Record<string, unknown>;

    if (method === "POST" && path === "/api/auth/login") {
      const account = this.accounts.find((entry) => entry.email === String(input.email).trim().toLowerCase());
      if (!account || account.password !== input.password) return failure(401, "INVALID_CREDENTIALS", "That email and password don't match an account.");
      return this.session(account);
    }

    if (method === "POST" && path === "/api/auth/register") {
      const problems: { field: string; message: string }[] = [];
      const email = String(input.email ?? "").trim().toLowerCase();
      const password = String(input.password ?? "");
      if (!String(input.name ?? "").trim()) problems.push({ field: "name", message: "Please enter your name." });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) problems.push({ field: "email", message: "That email address doesn't look right." });
      if (password.length < 10 || !/\p{L}/u.test(password) || !/\p{N}/u.test(password)) problems.push({ field: "password", message: "Use at least 10 characters, with at least one letter and one number." });
      if (input.accountType === "b2b" && !String(input.companyName ?? "").trim()) problems.push({ field: "companyName", message: "Please enter your company name." });
      if (problems.length > 0) return failure(400, "VALIDATION_ERROR", problems[0].message, problems);
      if (this.accounts.some((entry) => entry.email === email)) return failure(409, "EMAIL_TAKEN", "An account with that email already exists.");

      const account: FakeAccount = {
        id: `64b7f0c2a1b2c3d4e5f6${String(100 + this.accounts.length).padStart(4, "0")}`,
        email,
        password,
        name: String(input.name).trim(),
        accountType: input.accountType === "b2b" ? "b2b" : "retail",
        preferredLanguage: input.preferredLanguage === "es" ? "es" : "en",
        ...(input.accountType === "b2b" ? { companyName: String(input.companyName).trim(), verificationStatus: "pending" as const } : {}),
      };
      this.accounts.push(account);
      return this.session(account, 201);
    }

    if (method === "POST" && path === "/api/auth/refresh") {
      if (!this.cookieOf) return failure(401, "SESSION_EXPIRED", "Your session ended. Please sign in again.");
      return this.session(this.cookieOf);
    }

    if (method === "POST" && path === "/api/auth/logout") {
      this.cookieOf = null;
      this.tokenOf = null;
      return noContent();
    }

    if (method === "POST" && path === "/api/auth/forgot-password") return json({ ok: true });

    if (method === "POST" && path === "/api/auth/reset-password") {
      const password = String(input.password ?? "");
      if (password.length < 10 || !/\p{L}/u.test(password) || !/\p{N}/u.test(password)) return failure(400, "VALIDATION_ERROR", "Use at least 10 characters, with at least one letter and one number.", [{ field: "password", message: "weak" }]);
      if (typeof input.token !== "string" || !this.resetTokens.has(input.token)) return failure(400, "RESET_LINK_INVALID", "This reset link is not valid, or it has expired. Please ask for a new one.");
      this.resetTokens.delete(input.token);
      return noContent();
    }

    if (path.startsWith("/api/users/me")) return this.account(call, path, input);

    return this.shopRoute(call, path, input);
  }

  // ---------------------------------------------------------------- the shop

  // the stock of each product (by slug), and the products that are switched off. A test changes these to play the shop.
  stock = new Map<string, number>(fixtureRecords.map((record) => [record.product.slug, record.quantity]));
  inactive = new Set<string>();
  // the carts: one for each signed in account, and one for the visitor
  carts = new Map<string, FakeCartLine[]>();
  // what was sent through the contact form and the newsletter box
  inquiries: Record<string, unknown>[] = [];

  setStock(slug: string, quantity: number): this {
    this.stock.set(slug, quantity);
    return this;
  }

  private shopProduct(slug: string) {
    return fixtureRecords.find((record) => record.product.slug === slug && !this.inactive.has(slug));
  }

  private shopRoute(call: FakeCall, path: string, input: Record<string, unknown>): Response | undefined {
    const { method } = call;
    const lang: Lang = /^es\b/i.test(call.headers["accept-language"] ?? "") ? "es" : "en";
    const query = new URL(call.path, "http://localhost").searchParams;

    if (method === "GET" && path === "/api/products") {
      const list = (name: string) => (query.get(name) ?? "").split(",").filter(Boolean);
      const origins = list("origin");
      const categories = list("category");
      const notes = list("notes");
      const minPct = query.has("minPct") ? Number(query.get("minPct")) : undefined;
      const maxPct = query.has("maxPct") ? Number(query.get("maxPct")) : undefined;
      const limit = Math.min(48, Number(query.get("limit") ?? 12) || 12);
      const found = fixtureRecords
        .filter((record) => !this.inactive.has(record.product.slug))
        .filter(({ product }) => origins.length === 0 || origins.includes(product.origin))
        .filter(({ product }) => categories.length === 0 || categories.includes(product.category))
        .filter(({ product }) => notes.length === 0 || notes.some((note) => product.notes.includes(note)))
        .filter(({ product }) => minPct === undefined || product.percentage >= minPct)
        .filter(({ product }) => maxPct === undefined || product.percentage <= maxPct)
        .filter(({ product }) => query.get("featured") !== "true" || product.featured)
        .sort((a, b) => Number(b.product.featured) - Number(a.product.featured) || a.product.sortOrder - b.product.sortOrder);
      return json({ items: found.slice(0, limit).map((record) => wireProduct(record, lang, this.stock.get(record.product.slug))), page: 1, limit, total: found.length });
    }

    const one = /^\/api\/products\/([a-z0-9-]+)$/.exec(path);
    if (method === "GET" && one) {
      const record = this.shopProduct(one[1]);
      return record ? json({ product: wireProduct(record, lang, this.stock.get(one[1])) }) : failure(404, "NOT_FOUND", "That product wasn't found.");
    }

    if (path === "/api/cart" || path.startsWith("/api/cart/")) return this.cartRoute(call, path, input, lang);

    if (method === "POST" && path === "/api/inquiries") {
      const category = String(input.category ?? "");
      const email = String(input.email ?? "").trim();
      const problems: { field: string; message: string }[] = [];
      if (!["general", "wholesale", "support", "feedback", "newsletter"].includes(category)) problems.push({ field: "category", message: "Choose a category." });
      if (category !== "feedback" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) problems.push({ field: "email", message: "That email address doesn't look right." });
      if (["general", "wholesale", "support"].includes(category)) {
        if (String(input.name ?? "").trim().length < 2) problems.push({ field: "name", message: "Please enter your name." });
        if (String(input.message ?? "").trim().length < 10) problems.push({ field: "message", message: "Your message needs at least 10 characters." });
      }
      if (problems.length > 0) return failure(400, "VALIDATION_ERROR", problems[0].message, problems);
      // a hidden field that only a bot fills in: the answer is the usual one, and nothing is kept
      if (typeof input.website === "string" && input.website !== "") return json({ id: "000000000000000000000000" }, 201);
      this.inquiries.push({ ...input });
      return json({ id: `64b7f0c2a1b2c3d4e5f6${String(2000 + this.inquiries.length)}` }, 201);
    }

    return undefined;
  }

  private cartOwner(call: FakeCall): string | Response {
    if (!call.headers.authorization) return "guest";
    return this.tokenOf ? `user:${this.tokenOf.id}` : failure(401, "TOKEN_EXPIRED", "Your session ran out. Please sign in again.");
  }

  // how many units a line can have: the stock of each of its products minus what the other lines take
  private limitOf(line: FakeCartLine, lines: FakeCartLine[]): { available: number; name?: string } {
    let available = 99;
    let name: string | undefined;
    for (const id of line.productIds) {
      const record = fixtureRecords.find((entry) => fixtureId(entry.product.slug) === id);
      if (!record || this.inactive.has(record.product.slug)) return { available: 0 };
      const takenByOthers = lines.filter((other) => other.lineId !== line.lineId && other.productIds.includes(id)).reduce((sum, other) => sum + other.quantity, 0);
      const left = Math.max(0, (this.stock.get(record.product.slug) ?? 0) - takenByOthers);
      if (left < available) {
        available = left;
        name = record.product.name.en;
      }
    }
    return { available, name };
  }

  private cartView(lines: FakeCartLine[], lang: Lang) {
    const views = lines.map((line) => {
      const records = line.productIds.map((id) => fixtureRecords.find((entry) => fixtureId(entry.product.slug) === id));
      const found = records.filter((record): record is FixtureRecord => record !== undefined);
      const { available } = this.limitOf(line, lines);
      const unavailable = found.length < records.length || found.some((record) => this.inactive.has(record.product.slug));
      const sold = found.some((record) => (this.stock.get(record.product.slug) ?? 0) <= 0);
      return {
        lineId: line.lineId,
        kind: line.kind,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.unitPrice * line.quantity,
        available,
        issue: unavailable ? "unavailable" : sold ? "out_of_stock" : line.quantity > available ? "over_stock" : null,
        priceChanged: !unavailable && found.reduce((sum, record) => sum + record.product.price, 0) !== line.unitPrice,
        products: found.map((record) => {
          const wire = wireProduct(record, lang, this.stock.get(record.product.slug));
          return { id: wire.id, slug: wire.slug, name: wire.name, thumbnail: wire.thumbnail, imageAlt: wire.imageAlt, price: wire.price, stock: wire.stock, availability: wire.availability };
        }),
      };
    });
    return { lines: views, itemCount: views.reduce((sum, line) => sum + line.quantity, 0), subtotal: views.reduce((sum, line) => sum + line.lineTotal, 0), updatedAt: null };
  }

  private cartRoute(call: FakeCall, path: string, input: Record<string, unknown>, lang: Lang): Response | undefined {
    const { method } = call;
    const owner = this.cartOwner(call);
    if (owner instanceof Response) return owner;
    const lines = this.carts.get(owner) ?? [];
    const save = (next: FakeCartLine[]) => {
      this.carts.set(owner, next);
      return json({ cart: this.cartView(next, lang) });
    };
    const stockError = (line: FakeCartLine, all: FakeCartLine[]) => {
      const { available, name } = this.limitOf(line, all);
      if (line.quantity <= available) return undefined;
      const message = available <= 0 ? `${name ?? "That"} is sold out.` : `Only ${available} left of ${name}.`;
      return failure(409, "INSUFFICIENT_STOCK", message, [{ field: "quantity", available, message }]);
    };

    if (method === "GET" && path === "/api/cart") return json({ cart: this.cartView(lines, lang) });

    if (method === "DELETE" && path === "/api/cart") return save([]);

    if (method === "POST" && path === "/api/cart/items") {
      const quantity = input.quantity === undefined ? 1 : input.quantity;
      if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return failure(400, "VALIDATION_ERROR", "quantity must be from 1 to 99.", [{ field: "quantity", message: "bad" }]);
      const ids = input.kind === "product" ? [String(input.productId)] : input.kind === "sampler" && Array.isArray(input.productIds) ? input.productIds.map(String) : null;
      if (!ids || (input.kind === "sampler" && (ids.length < 4 || ids.length > 6 || new Set(ids).size !== ids.length))) return failure(400, "VALIDATION_ERROR", "A sampler needs 4 to 6 different specimens.", [{ field: "productIds", message: "bad" }]);

      const records = ids.map((id) => fixtureRecords.find((entry) => fixtureId(entry.product.slug) === id && !this.inactive.has(entry.product.slug)));
      if (records.some((record) => !record)) return failure(404, "NOT_FOUND", "That product wasn't found.");
      const sorted = [...ids].sort();
      const lineId = input.kind === "product" ? `p-${sorted[0]}` : `s-${tinyHash(sorted.join(","))}`;
      const existing = lines.find((line) => line.lineId === lineId);
      const next = existing ?? { lineId, kind: input.kind as "product" | "sampler", productIds: sorted, quantity: 0, unitPrice: (records as FixtureRecord[]).reduce((sum, record) => sum + record.product.price, 0) };
      next.quantity += quantity;
      const all = existing ? lines : [...lines, next];
      return stockError(next, all) ?? save(all);
    }

    const line = /^\/api\/cart\/items\/((?:p-[0-9a-f]{24})|(?:s-[0-9a-f]{20}))$/.exec(path);
    if (line) {
      const current = lines.find((entry) => entry.lineId === line[1]);
      if (!current) return failure(404, "NOT_FOUND", "That item isn't in your cart.");
      if (method === "DELETE") return save(lines.filter((entry) => entry !== current));
      if (method === "PATCH") {
        const quantity = input.quantity;
        if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return failure(400, "VALIDATION_ERROR", "quantity must be from 1 to 99.", [{ field: "quantity", message: "bad" }]);
        current.quantity = quantity;
        return stockError(current, lines) ?? save(lines);
      }
    }

    if (method === "POST" && path === "/api/cart/merge") {
      if (owner === "guest") return failure(401, "UNAUTHENTICATED", "Please sign in to do that.");
      const guest = this.carts.get("guest") ?? [];
      const merged = lines.map((entry) => ({ ...entry }));
      for (const incoming of guest) {
        const same = merged.find((entry) => entry.lineId === incoming.lineId);
        if (same) same.quantity = Math.min(99, same.quantity + incoming.quantity);
        else merged.push({ ...incoming });
      }
      for (const entry of merged) entry.quantity = Math.max(1, Math.min(entry.quantity, this.limitOf(entry, merged).available));
      this.carts.delete("guest");
      return save(merged);
    }

    return undefined;
  }

  private account(call: FakeCall, path: string, input: Record<string, unknown>): Response | undefined {
    const who = this.signedIn(call);
    if (who instanceof Response) return who;
    const { method } = call;

    if (method === "GET" && path === "/api/users/me") return json({ user: this.serverUser(who), b2bProfile: this.profileOf(who) });

    if (method === "PATCH" && path === "/api/users/me") {
      const allowed = ["name", "phone", "preferredLanguage", "marketingEmails"];
      const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
      if (unknown.length > 0) return failure(400, "VALIDATION_ERROR", "You can only change your name, phone, language and email choice here.", [{ field: "", message: "unknown" }]);
      if (input.name === "") return failure(400, "VALIDATION_ERROR", "Please enter your name.", [{ field: "name", message: "Please enter your name." }]);
      if (typeof input.name === "string") who.name = input.name;
      if ("phone" in input) who.phone = typeof input.phone === "string" && input.phone.trim() !== "" ? input.phone : undefined;
      if (input.preferredLanguage === "en" || input.preferredLanguage === "es") who.preferredLanguage = input.preferredLanguage;
      if (typeof input.marketingEmails === "boolean") who.marketingEmails = input.marketingEmails;
      return json({ user: this.serverUser(who) });
    }

    if (method === "PATCH" && path === "/api/users/me/password") {
      if (input.currentPassword !== who.password) return failure(400, "WRONG_PASSWORD", "Your current password isn't right.", [{ field: "currentPassword", message: "Your current password isn't right." }]);
      who.password = String(input.newPassword);
      return this.session(who);
    }

    if (path === "/api/users/me/b2b-profile") {
      if (who.accountType !== "b2b") return failure(403, "FORBIDDEN", "You don't have access to that.");
      if (method === "GET") return json({ b2bProfile: this.profileOf(who) });
      if (method === "PUT") {
        if (!String(input.companyName ?? "").trim()) return failure(400, "VALIDATION_ERROR", "Please enter your company name.", [{ field: "companyName", message: "Please enter your company name." }]);
        who.companyName = String(input.companyName).trim();
        who.taxId = typeof input.taxId === "string" && input.taxId !== "" ? input.taxId : undefined;
        who.industry = typeof input.industry === "string" && input.industry !== "" ? input.industry : undefined;
        return json({ b2bProfile: this.profileOf(who) });
      }
    }

    if (path === "/api/users/me/addresses" && method === "GET") return json({ addresses: this.addresses });

    if (path === "/api/users/me/addresses" && method === "POST") {
      const missing = ["label", "street", "city", "state", "postalCode", "country"].filter((key) => !String(input[key] ?? "").trim());
      if (missing.length > 0) return failure(400, "VALIDATION_ERROR", "Please fill in the address.", missing.map((field) => ({ field, message: "required" })));
      if (this.addresses.length >= 10) return failure(409, "ADDRESS_LIMIT", "You can keep up to 10 addresses. Delete one to add another.");
      const first = this.addresses.length === 0;
      if (!first && input.isDefault === true) for (const entry of this.addresses) entry.isDefault = false;
      const address: FakeAddress = {
        id: `64b7f0c2a1b2c3d4e5f6${String(900 + ++this.addressCount).padStart(4, "0")}`,
        label: String(input.label),
        street: String(input.street),
        ...(input.street2 ? { street2: String(input.street2) } : {}),
        city: String(input.city),
        state: String(input.state),
        postalCode: String(input.postalCode),
        country: String(input.country),
        isDefault: first || input.isDefault === true,
      };
      this.addresses.push(address);
      return json({ address }, 201);
    }

    const addressPath = /^\/api\/users\/me\/addresses\/([0-9a-f]{24})(\/default)?$/.exec(path);
    if (addressPath) {
      const address = this.addresses.find((entry) => entry.id === addressPath[1]);
      if (!address) return failure(404, "NOT_FOUND", "That address wasn't found.");
      if (method === "PATCH" && !addressPath[2]) {
        for (const [key, value] of Object.entries(input)) {
          if (key === "street2" && value === "") delete address.street2;
          else if (["label", "street", "street2", "city", "state", "postalCode", "country"].includes(key)) Object.assign(address, { [key]: value });
        }
        return json({ address });
      }
      if (method === "DELETE" && !addressPath[2]) {
        this.addresses = this.addresses.filter((entry) => entry !== address);
        if (address.isDefault && this.addresses[0]) this.addresses[0].isDefault = true;
        return noContent();
      }
      if (method === "POST" && addressPath[2]) {
        for (const entry of this.addresses) entry.isDefault = entry === address;
        return json({ address });
      }
    }

    return undefined;
  }
}

// replaces fetch with the fake for the rest of the test, and gives the fake back
// (vi is the global of the unit tests: the browser tests import this file for the class, and never call this)
export function installFakeServer(accounts?: FakeAccount[]): FakeServer {
  const server = new FakeServer(accounts);
  vi.stubGlobal("fetch", vi.fn(server.handle));
  return server;
}
