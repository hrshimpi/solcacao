// The handlers for /api/auth. The access token goes back in the body (the page keeps it in memory), the refresh
// token only ever goes in an httpOnly cookie that the page's scripts cannot read.
import type { CookieOptions, RequestHandler, Response } from "express";
import { AppError } from "../errors/AppError.ts";
import { parseOrThrow } from "../errors/validationError.ts";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "../schemas/auth.schema.ts";
import type { AuthService, AuthSession } from "../services/auth.service.ts";

export const REFRESH_COOKIE = "sc_refresh";

export interface CookieSettings {
  // only send the cookie over https
  secure: boolean;
  accessTokenMinutes: number;
}

// The cookie is only sent to the auth routes (the path), only to our own site (SameSite strict, so another website
// cannot make the browser send it) and scripts cannot read it (httpOnly).
function cookieOptions(settings: CookieSettings): CookieOptions {
  return { httpOnly: true, secure: settings.secure, sameSite: "strict", path: "/api/auth" };
}

// the cookie that holds the refresh token, if the request has one
export function refreshTokenOf(cookies: unknown): string | undefined {
  const value = typeof cookies === "object" && cookies !== null ? (cookies as Record<string, unknown>)[REFRESH_COOKIE] : undefined;
  return typeof value === "string" && value !== "" ? value : undefined;
}

export function createAuthController(service: AuthService, settings: CookieSettings) {
  const options = cookieOptions(settings);

  function setRefreshCookie(res: Response, session: AuthSession) {
    res.cookie(REFRESH_COOKIE, session.refreshToken, { ...options, expires: session.refreshExpiresAt });
  }

  const clearRefreshCookie = (res: Response) => void res.clearCookie(REFRESH_COOKIE, options);

  // what the page gets: who signed in, the short token, and how long it works
  function sessionBody(session: AuthSession) {
    return { user: session.user, accessToken: session.accessToken, expiresIn: settings.accessTokenMinutes * 60 };
  }

  const register: RequestHandler = async (req, res) => {
    const input = parseOrThrow(registerSchema, req.body ?? {});
    const session = await service.register(input);
    setRefreshCookie(res, session);
    res.status(201).json(sessionBody(session));
  };

  const login: RequestHandler = async (req, res) => {
    const input = parseOrThrow(loginSchema, req.body ?? {});
    const session = await service.login(input);
    setRefreshCookie(res, session);
    res.json(sessionBody(session));
  };

  const refresh: RequestHandler = async (req, res) => {
    try {
      const session = await service.refresh(refreshTokenOf(req.cookies));
      setRefreshCookie(res, session);
      res.json(sessionBody(session));
    } catch (error) {
      // a cookie that is no good any more is taken away, so the browser stops sending it
      if (error instanceof AppError && error.code === "SESSION_EXPIRED") clearRefreshCookie(res);
      throw error;
    }
  };

  const logout: RequestHandler = async (req, res) => {
    await service.logout(refreshTokenOf(req.cookies));
    clearRefreshCookie(res);
    res.status(204).end();
  };

  const forgotPassword: RequestHandler = async (req, res) => {
    const { email } = parseOrThrow(forgotPasswordSchema, req.body ?? {});
    await service.forgotPassword(email);
    // the same answer for an address that has an account and one that has not
    res.json({ ok: true });
  };

  const resetPassword: RequestHandler = async (req, res) => {
    const { token, password } = parseOrThrow(resetPasswordSchema, req.body ?? {});
    await service.resetPassword(token, password);
    res.status(204).end();
  };

  return { register, login, refresh, logout, forgotPassword, resetPassword, setRefreshCookie, clearRefreshCookie, sessionBody };
}
