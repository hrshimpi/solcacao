// A stand-in for XMLHttpRequest, so tests of uploads never reach a server and can decide what happens and when.
// By default every request is answered with a "not found" a moment after it was sent. A test that wants to answer
// by hand sets FakeXhr.autoAnswer to null, and then uses progress(), answer() and failNetwork() on FakeXhr.last.
import { vi } from "vitest";

type ProgressHandler = (event: { lengthComputable: boolean; loaded: number; total: number }) => void;

const notFound = { status: 404, body: { error: { code: "NOT_FOUND", message: "Not found.", details: [] } } };

export class FakeXhr {
  static requests: FakeXhr[] = [];
  static autoAnswer: { status: number; body: unknown } | null = notFound;

  static get last() {
    const request = FakeXhr.requests.at(-1);
    if (!request) throw new Error("no request was sent");
    return request;
  }

  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown = null;
  status = 0;
  responseText = "";
  sent = false;
  aborted = false;

  upload: { onprogress: ProgressHandler | null; onload: (() => void) | null } = { onprogress: null, onload: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXhr.requests.push(this);
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: unknown) {
    this.body = body;
    this.sent = true;
    const auto = FakeXhr.autoAnswer;
    if (auto) setTimeout(() => this.answer(auto.status, auto.body), 0);
  }

  abort() {
    this.aborted = true;
    this.onabort?.();
  }

  // the test says how much of the form has gone up
  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }

  // the test lets the server answer: an object is sent as JSON, a string is sent as it is
  answer(status: number, body: unknown) {
    this.upload.onload?.();
    this.status = status;
    this.responseText = typeof body === "string" ? body : JSON.stringify(body);
    this.onload?.();
  }

  failNetwork() {
    this.onerror?.();
  }
}

export function installFakeXhr() {
  FakeXhr.requests = [];
  FakeXhr.autoAnswer = notFound;
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
}
