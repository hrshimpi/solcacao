import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.ts";

// a logger that writes into a list, one parsed line each
function capture() {
  const lines: Record<string, unknown>[] = [];
  const destination = new Writable({
    write(chunk, _encoding, done) {
      lines.push(JSON.parse(chunk.toString()));
      done();
    },
  });
  return { lines, log: createLogger("info", destination) };
}

describe("the log", () => {
  it("never writes a password, a token or a cookie, at the top of an object or one level down", () => {
    const { log, lines } = capture();

    log.info({ password: "hunter2-secret", token: "abc.def.ghi", user: { newPassword: "brand new 42", refreshToken: "opaque-refresh" }, body: { cookie: "sc_refresh=xyz" } }, "a line");

    const text = JSON.stringify(lines[0]);
    for (const secret of ["hunter2-secret", "abc.def.ghi", "brand new 42", "opaque-refresh", "sc_refresh=xyz"]) expect(text).not.toContain(secret);
    expect(lines[0].password).toBe("[hidden]");
    expect((lines[0].user as Record<string, unknown>).newPassword).toBe("[hidden]");
  });

  it("never writes the number or the security code of a card, even deep inside the body of a request", () => {
    const { log, lines } = capture();

    log.info({ body: { payment: { cardNumber: "4242424242424242", cvc: "123", nameOnCard: "Isabel" } }, cardNumber: "4242424242424242" }, "an order");

    const text = JSON.stringify(lines[0]);
    expect(text).not.toContain("4242424242424242");
    expect(text).not.toContain('"cvc":"123"');
    expect(text).toContain("Isabel");
  });

  it("hides the Authorization and Cookie headers of a request, and the cookies that an answer sets", () => {
    const { log, lines } = capture();

    log.info({ req: { method: "GET", headers: { authorization: "Bearer secret-token", cookie: "sc_refresh=xyz", accept: "application/json" } }, res: { headers: { "set-cookie": "sc_refresh=new" } } }, "a request");

    const text = JSON.stringify(lines[0]);
    expect(text).not.toContain("secret-token");
    expect(text).not.toContain("sc_refresh");
    expect(text).toContain("application/json");
  });

  it("keeps everything else", () => {
    const { log, lines } = capture();

    log.info({ userId: "64b7f0c2a1b2c3d4e5f60718", status: 200 }, "a request");

    expect(lines[0]).toMatchObject({ userId: "64b7f0c2a1b2c3d4e5f60718", status: 200, msg: "a request" });
  });
});
