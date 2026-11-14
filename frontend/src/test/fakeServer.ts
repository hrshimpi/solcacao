// A stand-in for the backend, for the tests of pages that sign people in and read their account. It answers the way the real
// API does (the same paths, the same status codes and error codes), keeps its accounts in memory, and remembers every call
// so a test can look at what the page sent. Install it with installFakeServer(): it replaces fetch for the test.
// Everything it does not know answers 404 in the standard error shape.
import { vi } from "vitest";

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
export function installFakeServer(accounts?: FakeAccount[]): FakeServer {
  const server = new FakeServer(accounts);
  vi.stubGlobal("fetch", vi.fn(server.handle));
  return server;
}
