// The handlers for /api/users/me and /api/staff. The routes check the token before these run, so req.user is there.
import type { Request, RequestHandler, Response } from "express";
import { AppError } from "../errors/AppError.ts";
import { parseOrThrow } from "../errors/validationError.ts";
import {
  addressCreateSchema,
  addressIdSchema,
  addressPatchSchema,
  b2bProfileSchema,
  passwordChangeSchema,
  profilePatchSchema,
  userIdSchema,
  verificationSchema,
} from "../schemas/account.schema.ts";
import type { AccountService } from "../services/account.service.ts";
import type { AuthSession } from "../services/auth.service.ts";

// what the controller of the sign in routes gives for putting a new sign in in the answer
export interface SessionAnswer {
  setRefreshCookie(res: Response, session: AuthSession): void;
  sessionBody(session: AuthSession): object;
}

const userId = (req: Request): string => {
  if (!req.user) throw new AppError("UNAUTHENTICATED", 401, "Please sign in to do that.");
  return req.user.id;
};

export function createUsersController(account: AccountService, sessionAnswer: SessionAnswer) {
  const me: RequestHandler = async (req, res) => {
    res.json(await account.me(userId(req)));
  };

  const updateProfile: RequestHandler = async (req, res) => {
    const patch = parseOrThrow(profilePatchSchema, req.body ?? {});
    res.json({ user: await account.updateProfile(userId(req), patch) });
  };

  // the other sign ins end, so this answer carries a new one for the device that is changing the password
  const changePassword: RequestHandler = async (req, res) => {
    const { currentPassword, newPassword } = parseOrThrow(passwordChangeSchema, req.body ?? {});
    const session = await account.changePassword(userId(req), currentPassword, newPassword);
    sessionAnswer.setRefreshCookie(res, session);
    res.json(sessionAnswer.sessionBody(session));
  };

  const listAddresses: RequestHandler = async (req, res) => {
    res.json({ addresses: await account.listAddresses(userId(req)) });
  };

  const createAddress: RequestHandler = async (req, res) => {
    const input = parseOrThrow(addressCreateSchema, req.body ?? {});
    res.status(201).json({ address: await account.createAddress(userId(req), input) });
  };

  const updateAddress: RequestHandler = async (req, res) => {
    const id = parseOrThrow(addressIdSchema, req.params.id);
    const patch = parseOrThrow(addressPatchSchema, req.body ?? {});
    res.json({ address: await account.updateAddress(userId(req), id, patch) });
  };

  const deleteAddress: RequestHandler = async (req, res) => {
    const id = parseOrThrow(addressIdSchema, req.params.id);
    await account.deleteAddress(userId(req), id);
    res.status(204).end();
  };

  const setDefaultAddress: RequestHandler = async (req, res) => {
    const id = parseOrThrow(addressIdSchema, req.params.id);
    res.json({ address: await account.setDefaultAddress(userId(req), id) });
  };

  const getBusinessProfile: RequestHandler = async (req, res) => {
    res.json({ b2bProfile: await account.getBusinessProfile(userId(req)) });
  };

  const saveBusinessProfile: RequestHandler = async (req, res) => {
    const input = parseOrThrow(b2bProfileSchema, req.body ?? {});
    res.json({ b2bProfile: await account.saveBusinessProfile(userId(req), input) });
  };

  // for the team: the user is named in the address, not taken from a token
  const setVerification: RequestHandler = async (req, res) => {
    const id = parseOrThrow(userIdSchema, req.params.userId);
    const { verificationStatus } = parseOrThrow(verificationSchema, req.body ?? {});
    res.json({ b2bProfile: await account.setVerification(id, verificationStatus) });
  };

  return { me, updateProfile, changePassword, listAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress, getBusinessProfile, saveBusinessProfile, setVerification };
}
