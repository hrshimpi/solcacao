import { useState } from "react";
import { Page } from "../types";

interface AuthProps {
  setPage: (p: Page) => void;
}

export default function Auth({ setPage }: AuthProps) {
  const [accountType, setAccountType] = useState<"retail" | "business">("retail");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    company: "",
  });

  const update = (k: string, v: string) => setFormData((d) => ({ ...d, [k]: v }));

  return (
    <div className="pt-14 min-h-screen grid md:grid-cols-[1fr_1fr]">
      <div
        className="hidden md:flex flex-col justify-between p-14 bg-ink-cacao relative min-h-screen"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1722699350336-b22f6a263499?w=800&h=1000&fit=crop&auto=format)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-ink-cacao/80" />
        <div className="relative">
          <button
            onClick={() => setPage("home")}
            className="font-spectral text-xl font-semibold text-paper-text"
          >
            SolCacao
          </button>
        </div>
        <div className="relative">
          <p className="font-spectral text-3xl text-paper-text font-semibold leading-snug max-w-xs">
            From the same hands that grew the cacao.
          </p>
          <p className="font-spectral text-paper-text/50 mt-4 leading-relaxed max-w-xs">
            A direct account connects you to the source: farm notes, harvest records and early access to limited batches.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-sun-gold" />
            <p className="font-sans text-xs text-paper-text/50">
              Direct trade · Batch documentation · Field notes
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center px-8 md:px-14 py-16 bg-stone-paper">
        <div className="max-w-sm w-full mx-auto">
          <div className="flex items-center gap-6 mb-10 border-b border-ink-cacao/15 pb-5">
            {(["retail", "business"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setAccountType(t)}
                className={`font-sans text-sm pb-0 transition-colors ${
                  accountType === t
                    ? "text-ink-cacao font-medium underline underline-offset-4 decoration-ink-cacao"
                    : "text-ink-cacao/40 hover:text-ink-cacao/70"
                }`}
              >
                {t === "retail" ? "Retail account" : "Business account"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 mb-8">
            <h2 className="font-spectral text-3xl font-semibold text-ink-cacao">
              {mode === "login" ? "Sign in" : "Create account"}
            </h2>
          </div>

          <div className="space-y-6">
            {mode === "register" && (
              <div className="border-b border-ink-cacao/25 focus-within:border-pod-wine transition-colors pb-1">
                <label className="font-sans text-[9px] tracking-widest text-ink-cacao/40 uppercase block mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Isabel Vásquez"
                  className="w-full font-sans text-sm text-ink-cacao bg-transparent focus:outline-none placeholder-ink-cacao/25"
                />
              </div>
            )}

            {mode === "register" && accountType === "business" && (
              <div className="border-b border-ink-cacao/25 focus-within:border-pod-wine transition-colors pb-1">
                <label className="font-sans text-[9px] tracking-widest text-ink-cacao/40 uppercase block mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => update("company", e.target.value)}
                  placeholder="Hacienda Brands"
                  className="w-full font-sans text-sm text-ink-cacao bg-transparent focus:outline-none placeholder-ink-cacao/25"
                />
              </div>
            )}

            <div className="border-b border-ink-cacao/25 focus-within:border-pod-wine transition-colors pb-1">
              <label className="font-sans text-[9px] tracking-widest text-ink-cacao/40 uppercase block mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="you@domain.com"
                className="w-full font-sans text-sm text-ink-cacao bg-transparent focus:outline-none placeholder-ink-cacao/25"
              />
            </div>

            <div className="border-b border-ink-cacao/25 focus-within:border-pod-wine transition-colors pb-1">
              <label className="font-sans text-[9px] tracking-widest text-ink-cacao/40 uppercase block mb-1">
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="••••••••"
                className="w-full font-sans text-sm text-ink-cacao bg-transparent focus:outline-none placeholder-ink-cacao/25"
              />
            </div>
          </div>

          <button
            onClick={() => setPage("home")}
            className="mt-10 w-full font-sans text-sm font-medium bg-sun-gold text-ink-cacao py-3.5 hover:bg-sun-gold/90 transition-colors"
          >
            {mode === "login" ? "Sign in" : "Create account"}
          </button>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="font-sans text-xs text-ink-cacao/50 hover:text-ink-cacao transition-colors underline underline-offset-2"
            >
              {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
            {mode === "login" && (
              <button className="font-sans text-xs text-ink-cacao/40 hover:text-ink-cacao transition-colors">
                Forgot password?
              </button>
            )}
          </div>

          {accountType === "business" && (
            <div className="mt-8 border border-ink-cacao/15 bg-clay-surface p-4">
              <p className="font-sans text-[10px] text-ink-cacao/60 leading-relaxed">
                Business accounts unlock wholesale pricing, the Corporate Cacao Studio, and white-label ordering. Verification may take up to one business day.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
