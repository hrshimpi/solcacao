import { useState } from "react";
import { Page } from "../../types";

interface StudioProps {
  setPage: (p: Page) => void;
}

const ORIGINS = [
  { id: "ecu", label: "Ecuador 72%", sub: "Berry, jasmine (Esmeraldas Province)", color: "#6B1F2E" },
  { id: "per", label: "Peru 68%", sub: "Almond, earth (Junín Region)", color: "#2B4531" },
  { id: "ven", label: "Venezuela 76%", sub: "Violet, smoke (Barlovento)", color: "#1C1310" },
  { id: "col", label: "Colombia 64%", sub: "Mango, macadamia (Tumaco)", color: "#4A2A1A" },
  { id: "mad", label: "Madagascar 80%", sub: "Citrus, raspberry (Sambirano)", color: "#7A3B25" },
  { id: "custom", label: "Custom blend", sub: "Multi-origin, specify on review", color: "#EFA836" },
];

const PACKAGING = [
  { id: "foil", label: "Premium foil wrap", sub: "Matte or gloss, Pantone matched" },
  { id: "rigid", label: "Rigid gift box", sub: "Magnetic closure, 4-6 bars" },
  { id: "specimen", label: "Specimen card label", sub: "Kraft board + letterpress style" },
  { id: "sleeve", label: "Paper sleeve", sub: "Recycled board, minimal print" },
];

export default function StudioPage({ setPage }: StudioProps) {
  const [step, setStep] = useState(0);
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);
  const [selectedPackaging, setSelectedPackaging] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    company: "Hacienda Brands",
    contact: "Isabel Vásquez",
    quantity: "1000",
    notes: "",
  });

  const steps = [
    "Choose Your Cacao Profile",
    "Select Packaging & Branding",
    "Upload Your Brand Assets",
    "Review & Submit",
  ];

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).map((f) => f.name);
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).map((f) => f.name);
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  if (submitted) {
    return (
      <div className="pt-14 min-h-screen bg-stone-paper flex items-center justify-center">
        <div className="max-w-md mx-auto text-center px-6">
          <div className="border border-ink-cacao p-12 bg-clay-surface">
            <p className="font-sans text-[10px] tracking-[0.2em] text-ink-cacao/40 uppercase mb-4">
              Submission received
            </p>
            <h2 className="font-spectral text-3xl font-semibold text-ink-cacao mb-4">
              We have your brief.
            </h2>
            <p className="font-spectral text-ink-cacao/70 leading-relaxed mb-8">
              A quote for <strong>{formData.company}</strong> ({selectedOrigin && ORIGINS.find((o) => o.id === selectedOrigin)?.label}, {formData.quantity} units) will be sent to you within two business days.
            </p>
            <button
              onClick={() => setPage("wholesale")}
              className="font-sans text-sm font-medium border border-ink-cacao text-ink-cacao px-6 py-2.5 hover:bg-ink-cacao hover:text-stone-paper transition-colors"
            >
              Back to Wholesale
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-14 min-h-screen bg-stone-paper">
      <div className="bg-stone-paper border-b border-ink-cacao">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <p className="font-sans text-[10px] tracking-[0.2em] text-ink-cacao/40 uppercase mb-2">
            B2B · Wholesale
          </p>
          <h1 className="font-spectral text-3xl font-semibold text-ink-cacao">
            The Corporate Cacao Studio
          </h1>
        </div>

        <div className="max-w-4xl mx-auto px-6 pb-0">
          <div className="flex">
            {steps.map((label, i) => {
              const isCompleted = i < step;
              const isActive = i === step;
              return (
                <div key={label} className="flex items-stretch flex-1 min-w-0">
                  <div
                    className={`flex-1 px-4 py-4 border-t border-l border-b transition-colors cursor-pointer ${
                      i === steps.length - 1 ? "border-r" : ""
                    } ${
                      isCompleted
                        ? "bg-pod-wine border-pod-wine"
                        : isActive
                        ? "bg-stone-paper border-sun-gold border-2"
                        : "bg-stone-paper border-ink-cacao/20"
                    }`}
                    onClick={() => { if (i <= step) setStep(i); }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className={`font-mono text-[9px] ${
                          isCompleted
                            ? "text-paper-text/70"
                            : isActive
                            ? "text-sun-gold"
                            : "text-ink-cacao/30"
                        }`}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {isCompleted && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#F3ECDD" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M2 6 L5 9 L10 3" />
                        </svg>
                      )}
                    </div>
                    <p
                      className={`font-sans text-[10px] leading-tight hidden sm:block ${
                        isCompleted
                          ? "text-paper-text/80"
                          : isActive
                          ? "text-ink-cacao font-medium"
                          : "text-ink-cacao/35"
                      }`}
                    >
                      {label}
                    </p>
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`w-0 border-r-0 relative flex items-center ${
                        isCompleted ? "border-pod-wine" : "border-ink-cacao/15"
                      }`}
                    >
                      <div
                        className="absolute inset-y-0 w-px"
                        style={{
                          backgroundImage: `repeating-linear-gradient(to bottom, ${isCompleted ? "#6B1F2E" : "rgba(28,19,16,0.2)"} 0px, ${isCompleted ? "#6B1F2E" : "rgba(28,19,16,0.2)"} 4px, transparent 4px, transparent 8px)`,
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {step === 0 && (
          <div>
            <p className="font-spectral text-xl text-ink-cacao mb-2">
              Choose your cacao profile
            </p>
            <p className="font-sans text-xs text-ink-cacao/50 mb-8">
              Select a single origin or request a custom blend.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {ORIGINS.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelectedOrigin(o.id)}
                  className={`border p-5 text-left transition-all ${
                    selectedOrigin === o.id
                      ? "border-pod-wine bg-clay-surface"
                      : "border-ink-cacao/25 hover:border-ink-cacao bg-stone-paper"
                  }`}
                >
                  <div
                    className="w-full h-16 mb-4 border border-ink-cacao/10"
                    style={{ backgroundColor: o.color, opacity: 0.85 }}
                  />
                  <p className="font-spectral text-sm font-semibold text-ink-cacao">
                    {o.label}
                  </p>
                  <p className="font-sans text-[10px] text-ink-cacao/55 mt-1 leading-snug">
                    {o.sub}
                  </p>
                  {selectedOrigin === o.id && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-pod-wine" />
                      <span className="font-sans text-[9px] text-pod-wine font-medium">Selected</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="font-spectral text-xl text-ink-cacao mb-2">
              Select packaging & branding
            </p>
            <p className="font-sans text-xs text-ink-cacao/50 mb-8">
              All formats available in white-label or co-branded configurations.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PACKAGING.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPackaging(pkg.id)}
                  className={`border p-6 text-left flex items-start gap-4 transition-all ${
                    selectedPackaging === pkg.id
                      ? "border-pod-wine bg-clay-surface"
                      : "border-ink-cacao/25 hover:border-ink-cacao bg-stone-paper"
                  }`}
                >
                  <div
                    className={`w-14 h-14 border shrink-0 flex items-center justify-center transition-colors ${
                      selectedPackaging === pkg.id
                        ? "border-pod-wine bg-pod-wine/10"
                        : "border-ink-cacao/20 bg-clay-surface"
                    }`}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-ink-cacao/50">
                      <rect x="2" y="4" width="20" height="16" />
                      <path d="M2 8h20" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-spectral text-sm font-semibold text-ink-cacao">
                      {pkg.label}
                    </p>
                    <p className="font-sans text-[10px] text-ink-cacao/55 mt-1">
                      {pkg.sub}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="font-spectral text-xl text-ink-cacao mb-2">
              Upload your brand assets
            </p>
            <p className="font-sans text-xs text-ink-cacao/50 mb-8">
              Accepted formats: PDF, AI, EPS, PNG. Max 50 MB per file.
            </p>

            <label
              className={`block border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
                dragOver ? "border-pod-wine bg-pod-wine/5" : "border-pod-wine/40 hover:border-pod-wine/70"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
            >
              <input
                type="file"
                className="sr-only"
                multiple
                accept=".pdf,.ai,.eps,.png"
                onChange={handleFileInput}
              />
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-ink-cacao/30 mx-auto mb-3">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
              <p className="font-spectral text-sm text-ink-cacao/60">
                Drag files here or click to browse
              </p>
              <p className="font-sans text-[10px] text-ink-cacao/35 mt-1.5">
                PDF, AI, EPS, PNG · Max 50 MB
              </p>
            </label>

            {uploadedFiles.length > 0 && (
              <div className="mt-6 border-t border-ink-cacao/15 pt-4 space-y-2">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-ink-cacao/10">
                    <p className="font-sans text-xs text-ink-cacao">{f}</p>
                    <button
                      onClick={() => setUploadedFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="font-sans text-[10px] text-ink-cacao/40 hover:text-ink-cacao transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="font-spectral text-xl text-ink-cacao mb-2">
              Review & submit
            </p>
            <p className="font-sans text-xs text-ink-cacao/50 mb-8">
              Edit any field before submitting. A quote will be returned within two business days.
            </p>

            <div className="bg-clay-surface border border-ink-cacao p-8 mb-8">
              <p className="font-sans text-[10px] tracking-[0.2em] text-ink-cacao/40 uppercase mb-5">
                Order summary
              </p>
              <div className="space-y-4 mb-6">
                {[
                  {
                    label: "Cacao profile",
                    value: ORIGINS.find((o) => o.id === selectedOrigin)?.label || "Not chosen",
                  },
                  {
                    label: "Packaging",
                    value: PACKAGING.find((p) => p.id === selectedPackaging)?.label || "Not chosen",
                  },
                  {
                    label: "Brand assets",
                    value: uploadedFiles.length > 0 ? `${uploadedFiles.length} file(s)` : "None uploaded",
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-baseline justify-between border-b border-ink-cacao/15 pb-3">
                    <span className="font-sans text-[10px] tracking-widest text-ink-cacao/40 uppercase">
                      {label}
                    </span>
                    <span className="font-spectral text-sm text-ink-cacao">{value}</span>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { key: "company", label: "Company name" },
                  { key: "contact", label: "Contact name" },
                  { key: "quantity", label: "Estimated units" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="font-sans text-[9px] tracking-widest text-ink-cacao/40 uppercase block mb-1">
                      {label}
                    </label>
                    <input
                      type="text"
                      value={formData[key as keyof typeof formData]}
                      onChange={(e) => setFormData((d) => ({ ...d, [key]: e.target.value }))}
                      className="w-full font-sans text-sm text-ink-cacao bg-stone-paper border border-ink-cacao/30 px-3 py-2 focus:outline-none focus:border-ink-cacao transition-colors"
                    />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="font-sans text-[9px] tracking-widest text-ink-cacao/40 uppercase block mb-1">
                    Additional notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData((d) => ({ ...d, notes: e.target.value }))}
                    rows={3}
                    placeholder="Any specific requirements, timeline, or questions..."
                    className="w-full font-sans text-sm text-ink-cacao bg-stone-paper border border-ink-cacao/30 px-3 py-2 focus:outline-none focus:border-ink-cacao transition-colors resize-none placeholder-ink-cacao/30"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => setSubmitted(true)}
              className="font-sans text-sm font-medium bg-sun-gold text-ink-cacao px-10 py-3.5 hover:bg-sun-gold/90 transition-colors"
            >
              Submit for quote
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mt-12 pt-8 border-t border-ink-cacao/15">
          <button
            onClick={() => { if (step > 0) setStep(step - 1); else setPage("wholesale"); }}
            className="font-sans text-xs text-ink-cacao/50 hover:text-ink-cacao transition-colors"
          >
            ← {step === 0 ? "Back to Wholesale" : "Previous step"}
          </button>
          {step < 3 && (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 0 && !selectedOrigin || step === 1 && !selectedPackaging}
              className="font-sans text-sm font-medium bg-ink-cacao text-stone-paper px-8 py-3 hover:bg-pod-wine transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
