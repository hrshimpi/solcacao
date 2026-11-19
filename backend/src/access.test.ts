// Who may call what. Every route of the API is in the table below with the kind of person it is for, and the test calls it
// the way a person who is not allowed would: with no token, a made up one, one signed with another key, one that says
// "no algorithm", one that ran out, and (where it matters) the token of an account of the wrong kind. All of that is
// decided before a route touches the database, so no database is needed here. The routes that anybody may call are listed
// too, so a new route cannot be added without somebody saying who it is for (the last test counts the routes in the code).
import { readdirSync, readFileSync } from "node:fs";
import { SignJWT } from "jose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { env } from "./config/env.ts";
import { signToken } from "./middleware/auth.ts";

// open:     anybody. visitor: a visitor or a signed in person, but a token that is not good is refused.
// user:     a signed in person. business: a business account. admin: an admin. staff: an admin, or the staff key.
type Guard = "open" | "visitor" | "user" | "business" | "admin" | "staff";
type Method = "get" | "post" | "patch" | "put" | "delete";

const id = "64b7f0c2a1b2c3d4e5f60718";

const table: { file: string; method: Method; path: string; guard: Guard }[] = [
  { file: "auth.routes.ts", method: "post", path: "/api/auth/register", guard: "open" },
  { file: "auth.routes.ts", method: "post", path: "/api/auth/login", guard: "open" },
  { file: "auth.routes.ts", method: "post", path: "/api/auth/refresh", guard: "open" },
  { file: "auth.routes.ts", method: "post", path: "/api/auth/logout", guard: "open" },
  { file: "auth.routes.ts", method: "post", path: "/api/auth/forgot-password", guard: "open" },
  { file: "auth.routes.ts", method: "post", path: "/api/auth/reset-password", guard: "open" },

  { file: "b2b.routes.ts", method: "post", path: "/api/b2b/quote", guard: "business" },
  { file: "b2b.routes.ts", method: "get", path: "/api/b2b/requests", guard: "business" },
  { file: "b2b.routes.ts", method: "get", path: "/api/b2b/admin/requests", guard: "admin" },
  { file: "b2b.routes.ts", method: "get", path: `/api/b2b/requests/${id}`, guard: "user" },
  { file: "b2b.routes.ts", method: "get", path: `/api/b2b/requests/${id}/assets/file.pdf`, guard: "user" },
  { file: "b2b.routes.ts", method: "post", path: `/api/b2b/requests/${id}/respond`, guard: "business" },
  { file: "b2b.routes.ts", method: "patch", path: `/api/b2b/requests/${id}`, guard: "admin" },

  { file: "cart.routes.ts", method: "get", path: "/api/cart", guard: "visitor" },
  { file: "cart.routes.ts", method: "post", path: "/api/cart/items", guard: "visitor" },
  { file: "cart.routes.ts", method: "patch", path: `/api/cart/items/p-${id}`, guard: "visitor" },
  { file: "cart.routes.ts", method: "delete", path: `/api/cart/items/p-${id}`, guard: "visitor" },
  { file: "cart.routes.ts", method: "delete", path: "/api/cart", guard: "visitor" },
  { file: "cart.routes.ts", method: "post", path: "/api/cart/merge", guard: "user" },

  { file: "orders.routes.ts", method: "get", path: "/api/checkout", guard: "user" },
  { file: "orders.routes.ts", method: "post", path: "/api/orders", guard: "user" },
  { file: "orders.routes.ts", method: "get", path: "/api/orders", guard: "user" },
  { file: "orders.routes.ts", method: "get", path: `/api/orders/${id}`, guard: "user" },
  { file: "orders.routes.ts", method: "post", path: `/api/orders/${id}/cancel`, guard: "user" },

  { file: "admin.routes.ts", method: "get", path: "/api/admin/stats", guard: "admin" },
  { file: "admin.routes.ts", method: "get", path: "/api/admin/orders", guard: "admin" },
  { file: "admin.routes.ts", method: "get", path: `/api/admin/orders/${id}`, guard: "admin" },
  { file: "admin.routes.ts", method: "patch", path: `/api/admin/orders/${id}`, guard: "admin" },

  { file: "inquiries.ts", method: "post", path: "/api/inquiries", guard: "open" },
  { file: "inquiries.ts", method: "get", path: "/api/inquiries", guard: "admin" },
  { file: "inquiries.ts", method: "patch", path: `/api/inquiries/${id}`, guard: "admin" },

  { file: "products.routes.ts", method: "get", path: "/api/products", guard: "open" },
  { file: "products.routes.ts", method: "get", path: "/api/products/ecuador-72", guard: "open" },
  { file: "products.routes.ts", method: "get", path: "/api/products/ecuador-72/related", guard: "open" },
  { file: "products.routes.ts", method: "get", path: "/api/staff/products", guard: "staff" },
  { file: "products.routes.ts", method: "get", path: `/api/staff/products/${id}`, guard: "staff" },
  { file: "products.routes.ts", method: "post", path: "/api/staff/products", guard: "staff" },
  { file: "products.routes.ts", method: "patch", path: `/api/staff/products/${id}`, guard: "staff" },
  { file: "products.routes.ts", method: "put", path: `/api/staff/products/${id}/inventory`, guard: "staff" },

  { file: "users.routes.ts", method: "get", path: "/api/users/me", guard: "user" },
  { file: "users.routes.ts", method: "patch", path: "/api/users/me", guard: "user" },
  { file: "users.routes.ts", method: "patch", path: "/api/users/me/password", guard: "user" },
  { file: "users.routes.ts", method: "get", path: "/api/users/me/addresses", guard: "user" },
  { file: "users.routes.ts", method: "post", path: "/api/users/me/addresses", guard: "user" },
  { file: "users.routes.ts", method: "patch", path: `/api/users/me/addresses/${id}`, guard: "user" },
  { file: "users.routes.ts", method: "delete", path: `/api/users/me/addresses/${id}`, guard: "user" },
  { file: "users.routes.ts", method: "post", path: `/api/users/me/addresses/${id}/default`, guard: "user" },
  { file: "users.routes.ts", method: "get", path: "/api/users/me/b2b-profile", guard: "business" },
  { file: "users.routes.ts", method: "put", path: "/api/users/me/b2b-profile", guard: "business" },
  { file: "users.routes.ts", method: "patch", path: `/api/staff/b2b-profiles/${id}`, guard: "staff" },
];

const app = createApp();
const call = (row: { method: Method; path: string }) => request(app)[row.method](row.path);

// the tokens of people who may not be let in
const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const aMinuteAgo = () => Math.floor(Date.now() / 1000) - 60;

const tokens = {
  garbage: "not-a-token",
  noAlgorithm: `${base64url({ alg: "none", typ: "JWT" })}.${base64url({ sub: id, role: "admin", accountType: "retail" })}.`,
  otherKey: () => new SignJWT({ role: "admin", accountType: "retail" }).setProtectedHeader({ alg: "HS256" }).setSubject(id).setExpirationTime("15m").sign(new TextEncoder().encode("another key that the server does not have")),
  noRole: () => new SignJWT({ accountType: "retail" }).setProtectedHeader({ alg: "HS256" }).setSubject(id).setExpirationTime("15m").sign(new TextEncoder().encode(env.JWT_SECRET)),
  expired: () => signToken({ id, role: "user" }, aMinuteAgo()),
  retail: () => signToken({ id, role: "user", accountType: "retail" }),
  business: () => signToken({ id, role: "user", accountType: "b2b" }),
};

const guarded = table.filter((row) => row.guard !== "open");
const withSignIn = guarded.filter((row) => row.guard !== "visitor");

describe("who may call what: a person who is not signed in", () => {
  it.each(withSignIn.map((row) => [`${row.method.toUpperCase()} ${row.path}`, row] as const))("%s is refused without a token", async (_name, row) => {
    const res = await call(row);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it.each(guarded.map((row) => [`${row.method.toUpperCase()} ${row.path}`, row] as const))("%s refuses a token that is not good", async (_name, row) => {
    for (const token of [tokens.garbage, tokens.noAlgorithm, await tokens.otherKey(), await tokens.noRole()]) {
      const res = await call(row).set("Authorization", `Bearer ${token}`);

      expect(res.status, token).toBe(401);
      expect(res.body.error.code, token).toBe("UNAUTHENTICATED");
    }
  });

  it.each(guarded.map((row) => [`${row.method.toUpperCase()} ${row.path}`, row] as const))("%s tells a token that ran out apart, so the page can renew it", async (_name, row) => {
    const res = await call(row).set("Authorization", `Bearer ${await tokens.expired()}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it.each(withSignIn.map((row) => [`${row.method.toUpperCase()} ${row.path}`, row] as const))("%s does not take a good token from anywhere but the Authorization header", async (_name, row) => {
    // a good token in a cookie, in the address, or with another scheme is not a login
    const token = await tokens.retail();
    for (const res of [await call(row).set("Authorization", `Basic ${token}`), await call(row).set("Cookie", `token=${token}`), await call(row).query({ token })]) {
      expect(res.status).toBe(401);
    }
  });

  it.each(table.filter((row) => row.guard === "visitor").map((row) => [`${row.method.toUpperCase()} ${row.path}`, row] as const))("%s is not for a login that is not a Bearer token either", async (_name, row) => {
    expect((await call(row).set("Authorization", `Basic ${await tokens.retail()}`)).status).toBe(401);
  });
});

describe("who may call what: a signed in person of the wrong kind", () => {
  const businessOnly = table.filter((row) => row.guard === "business");
  const adminOnly = table.filter((row) => row.guard === "admin" || row.guard === "staff");

  it.each(businessOnly.map((row) => [`${row.method.toUpperCase()} ${row.path}`, row] as const))("%s is for business accounts: a retail account is refused", async (_name, row) => {
    const res = await call(row).set("Authorization", `Bearer ${await tokens.retail()}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it.each(adminOnly.map((row) => [`${row.method.toUpperCase()} ${row.path}`, row] as const))("%s is for admins: a retail and a business account are refused", async (_name, row) => {
    for (const token of [await tokens.retail(), await tokens.business()]) {
      const res = await call(row).set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }
  });

  it.each(table.filter((row) => row.guard === "staff").map((row) => [`${row.method.toUpperCase()} ${row.path}`, row] as const))("%s refuses a staff key that is wrong or empty", async (_name, row) => {
    for (const key of ["wrong-key-that-is-long-enough-123", ""]) {
      const res = await call(row).set("X-Staff-Key", key);

      expect(res.status).toBe(401);
    }
  });
});

describe("who may call what: the table is complete", () => {
  // every router.get, router.post... of the route files, so a route that nobody wrote down here fails this test
  const files = readdirSync(new URL("./routes/", import.meta.url)).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts") && name !== "index.ts" && name !== "health.ts");

  it.each(files)("%s: every route of the file is in the table", (file) => {
    const source = readFileSync(new URL(`./routes/${file}`, import.meta.url), "utf8");
    const inCode = (source.match(/\brouter\.(get|post|patch|put|delete)\(/g) ?? []).length;
    const inTable = table.filter((row) => row.file === file).length;

    expect(inTable, `${file} has ${inCode} routes and the table has ${inTable}. Add the new route to the table with who it is for.`).toBe(inCode);
  });

  it("has a file for every row of the table", () => {
    expect(new Set(table.map((row) => row.file))).toEqual(new Set(files));
  });
});
