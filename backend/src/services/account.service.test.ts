import { describe, expect, it, vi } from "vitest";
import type { AddressCreateInput } from "../schemas/account.schema.ts";
import { createMemoryAddressStore } from "../test/memoryAddressStore.ts";
import { createMemoryB2BProfileStore } from "../test/memoryB2BProfileStore.ts";
import { createMemoryUserStore } from "../test/memoryUserStore.ts";
import { createAccountService, MAX_ADDRESSES } from "./account.service.ts";

const address = (label: string, extra: Partial<AddressCreateInput> = {}): AddressCreateInput => ({
  label,
  street: "12 Cacao Lane",
  city: "Arlington",
  state: "TX",
  postalCode: "76010",
  country: "United States",
  ...extra,
});

async function setup() {
  const users = createMemoryUserStore();
  const profiles = createMemoryB2BProfileStore();
  const addresses = createMemoryAddressStore();
  const auth = { changePassword: vi.fn(async () => ({ user: {} }) as never) };
  const service = createAccountService({ users, profiles, addresses, auth });

  const retail = await users.create({ email: "marco@example.com", name: "Marco", passwordHash: "x", accountType: "retail", preferredLanguage: "es" });
  const business = await users.create({ email: "isabel@hacienda.example", name: "Isabel", passwordHash: "x", accountType: "b2b", preferredLanguage: "en" });
  return { service, users, profiles, addresses, auth, retail, business };
}

describe("me", () => {
  it("gives a retail account without business details", async () => {
    const { service, retail } = await setup();

    expect(await service.me(retail.id)).toEqual({ user: retail, b2bProfile: null });
  });

  it("gives a business account with its business details, when there are any", async () => {
    const { service, business, profiles } = await setup();
    await profiles.save(business.id, { companyName: "Hacienda Brands" });

    const { user, b2bProfile } = await service.me(business.id);

    expect(user.id).toBe(business.id);
    expect(b2bProfile).toMatchObject({ companyName: "Hacienda Brands", verificationStatus: "pending" });
  });

  it("asks a person whose account is gone to sign in again", async () => {
    const { service } = await setup();

    await expect(service.me("64b7f0c2a1b2c3d4e5f607ff")).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
  });
});

describe("updateProfile", () => {
  it("changes what is sent and keeps the rest", async () => {
    const { service, retail } = await setup();

    const user = await service.updateProfile(retail.id, { name: "Marco Rossi", phone: "+1 555 010 2030" });

    expect(user).toMatchObject({ name: "Marco Rossi", phone: "+1 555 010 2030", preferredLanguage: "es", email: "marco@example.com" });
  });

  it("asks a person whose account is gone to sign in again", async () => {
    const { service } = await setup();

    await expect(service.updateProfile("64b7f0c2a1b2c3d4e5f607ff", { name: "Nobody" })).rejects.toMatchObject({ status: 401 });
  });
});

describe("changePassword", () => {
  it("hands the work to the auth service, which checks the current password and ends the other sign ins", async () => {
    const { service, auth, retail } = await setup();

    await service.changePassword(retail.id, "old pass 1234", "new pass 5678");

    expect(auth.changePassword).toHaveBeenCalledWith(retail.id, "old pass 1234", "new pass 5678");
  });
});

describe("addresses", () => {
  it("makes the first address the default, even when the person did not ask for it", async () => {
    const { service, retail } = await setup();

    const first = await service.createAddress(retail.id, address("Home"));

    expect(first.isDefault).toBe(true);
  });

  it("keeps a later address as it is, and makes it the default only when asked", async () => {
    const { service, retail } = await setup();
    const home = await service.createAddress(retail.id, address("Home"));

    const office = await service.createAddress(retail.id, address("Office"));
    expect(office.isDefault).toBe(false);

    const studio = await service.createAddress(retail.id, address("Studio", { isDefault: true }));
    expect(studio.isDefault).toBe(true);

    const all = await service.listAddresses(retail.id);
    expect(all.filter((entry) => entry.isDefault).map((entry) => entry.label)).toEqual(["Studio"]);
    expect(all.map((entry) => entry.id)).toEqual([home.id, office.id, studio.id]);
  });

  it(`keeps at most ${MAX_ADDRESSES} addresses for a person, and says why`, async () => {
    const { service, retail } = await setup();
    for (let index = 0; index < MAX_ADDRESSES; index++) await service.createAddress(retail.id, address(`Place ${index}`));

    await expect(service.createAddress(retail.id, address("One too many"))).rejects.toMatchObject({ status: 409, code: "ADDRESS_LIMIT" });
    expect(await service.listAddresses(retail.id)).toHaveLength(MAX_ADDRESSES);
  });

  it("counts the addresses of each person on their own", async () => {
    const { service, retail, business } = await setup();
    for (let index = 0; index < MAX_ADDRESSES; index++) await service.createAddress(retail.id, address(`Place ${index}`));

    await expect(service.createAddress(business.id, address("Mine"))).resolves.toMatchObject({ isDefault: true });
  });

  it("changes an address of the person", async () => {
    const { service, retail } = await setup();
    const home = await service.createAddress(retail.id, address("Home"));

    const changed = await service.updateAddress(retail.id, home.id, { city: "Dallas", street2: "Apt 3" });

    expect(changed).toMatchObject({ city: "Dallas", street2: "Apt 3", label: "Home" });
  });

  it("finds no address of another person to change, delete or make the default", async () => {
    const { service, retail, business } = await setup();
    const theirs = await service.createAddress(business.id, address("Theirs"));

    await expect(service.updateAddress(retail.id, theirs.id, { city: "Hacked" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    await expect(service.deleteAddress(retail.id, theirs.id)).rejects.toMatchObject({ status: 404 });
    await expect(service.setDefaultAddress(retail.id, theirs.id)).rejects.toMatchObject({ status: 404 });
    expect(await service.listAddresses(business.id)).toEqual([expect.objectContaining({ city: "Arlington", isDefault: true })]);
  });

  it("hands the default to the oldest address that is left when the default is deleted", async () => {
    const { service, retail } = await setup();
    const home = await service.createAddress(retail.id, address("Home"));
    const office = await service.createAddress(retail.id, address("Office"));
    await service.createAddress(retail.id, address("Studio"));

    await service.deleteAddress(retail.id, home.id);

    const all = await service.listAddresses(retail.id);
    expect(all.map((entry) => [entry.label, entry.isDefault])).toEqual([
      ["Office", true],
      ["Studio", false],
    ]);
    expect(all[0].id).toBe(office.id);
  });

  it("leaves the default alone when another address is deleted", async () => {
    const { service, retail } = await setup();
    await service.createAddress(retail.id, address("Home"));
    const office = await service.createAddress(retail.id, address("Office"));

    await service.deleteAddress(retail.id, office.id);

    expect(await service.listAddresses(retail.id)).toEqual([expect.objectContaining({ label: "Home", isDefault: true })]);
  });

  it("is fine with the last address going", async () => {
    const { service, retail } = await setup();
    const home = await service.createAddress(retail.id, address("Home"));

    await service.deleteAddress(retail.id, home.id);

    expect(await service.listAddresses(retail.id)).toEqual([]);
  });

  it("makes another address the default", async () => {
    const { service, retail } = await setup();
    await service.createAddress(retail.id, address("Home"));
    const office = await service.createAddress(retail.id, address("Office"));

    expect((await service.setDefaultAddress(retail.id, office.id)).isDefault).toBe(true);
    expect((await service.listAddresses(retail.id)).filter((entry) => entry.isDefault)).toHaveLength(1);
  });

  it("says an address that does not exist was not found", async () => {
    const { service, retail } = await setup();

    await expect(service.updateAddress(retail.id, "64b7f0c2a1b2c3d4e5f607ff", { city: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("business details", () => {
  it("are only for business accounts", async () => {
    const { service, retail } = await setup();

    await expect(service.getBusinessProfile(retail.id)).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    await expect(service.saveBusinessProfile(retail.id, { companyName: "Marco Foods" })).rejects.toMatchObject({ status: 403 });
  });

  it("do not exist until they are saved", async () => {
    const { service, business } = await setup();

    await expect(service.getBusinessProfile(business.id)).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("are saved as pending, changed later, and a field can be taken away", async () => {
    const { service, business } = await setup();

    const saved = await service.saveBusinessProfile(business.id, { companyName: "Hacienda Brands", taxId: "12-3456789", industry: "Hospitality" });
    expect(saved).toMatchObject({ verificationStatus: "pending", taxId: "12-3456789" });

    const changed = await service.saveBusinessProfile(business.id, { companyName: "Hacienda Brands LLC", taxId: null });
    expect(changed).toMatchObject({ companyName: "Hacienda Brands LLC", industry: "Hospitality" });
    expect(changed.taxId).toBeUndefined();
  });

  it("keep the verification that the team gave, whatever is saved afterwards", async () => {
    const { service, business } = await setup();
    await service.saveBusinessProfile(business.id, { companyName: "Hacienda Brands" });
    await service.setVerification(business.id, "verified");

    const changed = await service.saveBusinessProfile(business.id, { companyName: "A New Name" });

    expect(changed.verificationStatus).toBe("verified");
  });

  it("can be verified by the team, and a user without details cannot", async () => {
    const { service, business, retail } = await setup();
    await service.saveBusinessProfile(business.id, { companyName: "Hacienda Brands" });

    expect(await service.setVerification(business.id, "rejected")).toMatchObject({ verificationStatus: "rejected" });
    await expect(service.setVerification(retail.id, "verified")).rejects.toMatchObject({ status: 404 });
  });
});
