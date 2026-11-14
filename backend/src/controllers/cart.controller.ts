// The handlers for /api/cart. Whose cart it is comes from the request: a signed in user has theirs, and a visitor
// has the one that belongs to the id in a signed cookie (sc_guest). The cookie is made the first time a visitor
// puts something in the cart, and every change gives it 30 more days.
import { randomUUID } from "node:crypto";
import type { CookieOptions, Request, RequestHandler, Response } from "express";
import { AppError } from "../errors/AppError.ts";
import { parseOrThrow } from "../errors/validationError.ts";
import { addItemSchema, lineIdSchema, quantitySchema } from "../schemas/cart.schema.ts";
import { GUEST_CART_DAYS, type CartService } from "../services/cart.service.ts";
import type { CartOwner } from "../services/cart.store.ts";

export const GUEST_COOKIE = "sc_guest";

export interface GuestCookieSettings {
  secure: boolean;
}

// signed, so it cannot be made up, and not readable by scripts. Lax lets it come along when somebody follows a link to the shop.
function guestCookie(settings: GuestCookieSettings): CookieOptions {
  return { httpOnly: true, secure: settings.secure, sameSite: "lax", path: "/api", signed: true };
}

// the id in the cookie, when it is a good one. A cookie whose signature is wrong is not in signedCookies at all.
function guestIdOf(req: Request): string | undefined {
  const value: unknown = req.signedCookies?.[GUEST_COOKIE];
  return typeof value === "string" && /^[\w-]{8,64}$/.test(value) ? value : undefined;
}

export function createCartController(service: CartService, settings: GuestCookieSettings) {
  const options = guestCookie(settings);

  // for reading: the cart of the user or of the visitor, or null for a visitor who has none yet
  function readOwner(req: Request): CartOwner | null {
    if (req.user) return { userId: req.user.id };
    const guestId = guestIdOf(req);
    return guestId ? { guestId } : null;
  }

  // for changing: a visitor who has no cart yet gets an id and the cookie for it
  function writeOwner(req: Request, res: Response): CartOwner {
    if (req.user) return { userId: req.user.id };
    const guestId = guestIdOf(req) ?? randomUUID();
    res.cookie(GUEST_COOKIE, guestId, { ...options, maxAge: GUEST_CART_DAYS * 24 * 60 * 60 * 1000 });
    return { guestId };
  }

  const get: RequestHandler = async (req, res) => {
    res.json({ cart: await service.get(readOwner(req), req.lang) });
  };

  const addItem: RequestHandler = async (req, res) => {
    const input = parseOrThrow(addItemSchema, req.body ?? {});
    res.json({ cart: await service.addItem(writeOwner(req, res), input, req.lang) });
  };

  const setQuantity: RequestHandler = async (req, res) => {
    const lineId = parseOrThrow(lineIdSchema, req.params.lineId);
    const { quantity } = parseOrThrow(quantitySchema, req.body ?? {});
    res.json({ cart: await service.setQuantity(writeOwner(req, res), lineId, quantity, req.lang) });
  };

  const removeItem: RequestHandler = async (req, res) => {
    const lineId = parseOrThrow(lineIdSchema, req.params.lineId);
    res.json({ cart: await service.removeItem(writeOwner(req, res), lineId, req.lang) });
  };

  const clear: RequestHandler = async (req, res) => {
    const owner = readOwner(req);
    res.json({ cart: owner ? await service.clear(owner, req.lang) : await service.get(null, req.lang) });
  };

  // after a sign in: the cart the visitor made goes into the cart of the user
  const merge: RequestHandler = async (req, res) => {
    if (!req.user) throw new AppError("UNAUTHENTICATED", 401, "Please sign in to do that.");
    const guestId = guestIdOf(req);
    const cart = guestId ? await service.merge(req.user.id, guestId, req.lang) : await service.get({ userId: req.user.id }, req.lang);
    // taking a cookie away needs the same place and flags, but there is nothing to sign
    const { signed: _signed, ...unsigned } = options;
    res.clearCookie(GUEST_COOKIE, unsigned);
    res.json({ cart });
  };

  return { get, addItem, setQuantity, removeItem, clear, merge };
}
