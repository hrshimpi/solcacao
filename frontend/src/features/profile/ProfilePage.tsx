import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";

interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

export const ProfilePage: React.FC = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<"details" | "addresses">("details");

  const [addresses, setAddresses] = useState<Address[]>([
    {
      id: "addr-default-1",
      label: "Main Office",
      street: "701 S Nedderman Dr",
      city: "Arlington",
      state: "TX",
      zipCode: "76019",
      country: "USA",
      isDefault: true
    }
  ]);

  const [newStreet, setNewStreet] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [newZip, setNewZip] = useState("");
  const [newLabel, setNewLabel] = useState("shipping");

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStreet.trim() || !newCity.trim()) return;

    const created: Address = {
      id: `addr-${Date.now()}`,
      label: newLabel,
      street: newStreet.trim(),
      city: newCity.trim(),
      state: newState.trim(),
      zipCode: newZip.trim(),
      country: "USA",
      isDefault: addresses.length === 0
    };

    setAddresses([...addresses, created]);
    setNewStreet("");
    setNewCity("");
    setNewState("");
    setNewZip("");
  };

  const handleSetDefault = (id: string) => {
    setAddresses(
      addresses.map((a) => ({
        ...a,
        isDefault: a.id === id
      }))
    );
  };

  const handleDeleteAddress = (id: string) => {
    setAddresses(addresses.filter((a) => a.id !== id));
  };

  return (
    <main className="min-h-[85vh] bg-[#F0EDE4] px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#1C1310]/15 pb-6 mb-8 gap-4">
          <div>
            <h1 className="font-serif text-3xl text-[#1C1310]">Account Dashboard</h1>
            <p className="text-xs text-[#1C1310]/70 mt-1">
              Single-origin traceability, saved delivery destinations, and enterprise tier details.
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="px-4 py-2 border border-[#1C1310]/30 rounded text-xs font-semibold uppercase tracking-wider text-[#1C1310] hover:bg-[#1C1310]/5 transition"
          >
            Sign Out
          </button>
        </header>

        <nav aria-label="Profile Tabs" className="flex border-b border-[#1C1310]/15 mb-8">
          <button
            type="button"
            className={`py-2 px-6 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === "details"
                ? "border-b-2 border-[#6B1F2E] text-[#6B1F2E]"
                : "text-[#1C1310]/60 hover:text-[#1C1310]"
            }`}
            onClick={() => setActiveTab("details")}
          >
            Account Details
          </button>
          <button
            type="button"
            className={`py-2 px-6 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === "addresses"
                ? "border-b-2 border-[#6B1F2E] text-[#6B1F2E]"
                : "text-[#1C1310]/60 hover:text-[#1C1310]"
            }`}
            onClick={() => setActiveTab("addresses")}
          >
            Saved Addresses ({addresses.length})
          </button>
        </nav>

        {activeTab === "details" && (
          <section aria-labelledby="profile-overview" className="space-y-6">
            <h2 id="profile-overview" className="sr-only">
              Profile Overview
            </h2>
            <div className="bg-[#E3D9C6] border border-[#1C1310]/15 rounded p-6 max-w-xl space-y-4">
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/60">
                  Full Name
                </span>
                <p className="text-sm font-medium text-[#1C1310] mt-0.5">
                  {user?.fullName || "Guest Collector"}
                </p>
              </div>

              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/60">
                  Registered Email
                </span>
                <p className="text-sm font-medium text-[#1C1310] mt-0.5">
                  {user?.email || "No email linked (Browsing as guest)"}
                </p>
              </div>

              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/60">
                  Account Tier
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider bg-[#6B1F2E] text-white rounded">
                    {user?.accountType === "business" ? "B2B Enterprise" : "Retail Customer"}
                  </span>
                  {user?.accountType === "business" && (
                    <span className="text-xs text-[#1C1310]/70">
                      Standard Wholesale Terms (500 units minimum)
                    </span>
                  )}
                </div>
              </div>

              {user?.companyName && (
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310]/60">
                    Enterprise Organization
                  </span>
                  <p className="text-sm font-medium text-[#1C1310] mt-0.5">{user.companyName}</p>
                </div>
              )}
            </div>

            {user?.accountType === "business" && (
              <div className="bg-white border border-[#1C1310]/15 rounded p-6 max-w-xl">
                <h3 className="font-serif text-lg text-[#1C1310] mb-1">Corporate Cacao Studio</h3>
                <p className="text-xs text-[#1C1310]/70 mb-4">
                  Manage your active custom chocolate molds, quotes, and vector asset uploads.
                </p>
                <a
                  href="/wholesale/studio"
                  className="inline-block px-4 py-2 bg-[#EFA836] text-[#1C1310] text-xs font-semibold uppercase tracking-wider rounded hover:brightness-105 transition"
                >
                  Open Studio Wizard
                </a>
              </div>
            )}
          </section>
        )}

        {activeTab === "addresses" && (
          <section aria-labelledby="addresses-heading" className="space-y-8">
            <h2 id="addresses-heading" className="sr-only">
              Delivery Addresses
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((address) => (
                <article
                  key={address.id}
                  className="bg-white border border-[#1C1310]/15 rounded p-5 relative shadow-xs"
                >
                  {address.isDefault && (
                    <span className="absolute top-4 right-4 text-[10px] uppercase font-bold tracking-wider bg-[#6B1F2E] text-white px-2 py-0.5 rounded">
                      Default
                    </span>
                  )}
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-[#1C1310]/60">
                    {address.label}
                  </span>
                  <p className="text-sm font-medium text-[#1C1310] mt-1">{address.street}</p>
                  <p className="text-xs text-[#1C1310]/70">
                    {address.city}, {address.state} {address.zipCode}
                  </p>
                  <p className="text-xs text-[#1C1310]/70">{address.country}</p>

                  <div className="mt-4 pt-3 border-t border-[#1C1310]/10 flex gap-3 text-xs">
                    {!address.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(address.id)}
                        className="text-[#6B1F2E] font-medium hover:underline"
                      >
                        Set as Default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(address.id)}
                      className="text-red-700 font-medium hover:underline ml-auto"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="bg-[#E3D9C6] border border-[#1C1310]/15 rounded p-6 max-w-xl">
              <h3 className="font-serif text-lg text-[#1C1310] mb-4">Add Shipping Destination</h3>
              <form onSubmit={handleAddAddress} className="space-y-4">
                <div>
                  <label
                    htmlFor="addr-label"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310] mb-1"
                  >
                    Location Label
                  </label>
                  <select
                    id="addr-label"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#1C1310]/20 rounded"
                  >
                    <option value="shipping">Shipping Address</option>
                    <option value="office">Corporate / Office</option>
                    <option value="home">Residential</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="addr-street"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310] mb-1"
                  >
                    Street Address
                  </label>
                  <input
                    id="addr-street"
                    type="text"
                    required
                    value={newStreet}
                    onChange={(e) => setNewStreet(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#1C1310]/20 rounded"
                    placeholder="e.g. 701 S Nedderman Dr"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="addr-city"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310] mb-1"
                    >
                      City
                    </label>
                    <input
                      id="addr-city"
                      type="text"
                      required
                      value={newCity}
                      onChange={(e) => setNewCity(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#1C1310]/20 rounded"
                      placeholder="Arlington"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="addr-state"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310] mb-1"
                    >
                      State
                    </label>
                    <input
                      id="addr-state"
                      type="text"
                      value={newState}
                      onChange={(e) => setNewState(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#1C1310]/20 rounded"
                      placeholder="TX"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="addr-zip"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-[#1C1310] mb-1"
                    >
                      Zip Code
                    </label>
                    <input
                      id="addr-zip"
                      type="text"
                      value={newZip}
                      onChange={(e) => setNewZip(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#1C1310]/20 rounded"
                      placeholder="76019"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1C1310] text-white text-xs font-semibold uppercase tracking-wider rounded hover:bg-[#1C1310]/85 transition"
                >
                  Save Destination
                </button>
              </form>
            </div>
          </section>
        )}
      </div>
    </main>
  );
};

export default ProfilePage;