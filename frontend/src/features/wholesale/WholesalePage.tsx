import { useNavigate } from "react-router";

export default function WholesalePage() {
  const navigate = useNavigate();
  const features = [
    {
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <path d="M14 14h7v7h-7z" strokeDasharray="2 2" />
        </svg>
      ),
      title: "Custom molds",
      body: "Bar shapes, tablet formats, and truffle configurations designed around your product requirements. Minimum run of 500 units per SKU.",
    },
    {
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        >
          <rect x="2" y="6" width="20" height="14" rx="0" />
          <path d="M2 10h20" />
          <circle cx="8" cy="14" r="1" fill="currentColor" />
        </svg>
      ),
      title: "Luxury packaging",
      body: "Rigid boxes, foil wraps, and specimen-label card inserts. Printed offset in Pantone or CMYK. We work with three regional printers to match any brand standard.",
    },
    {
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5Z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
      title: "White-label branding",
      body: "Full white-label runs using your brand identity. The Batch Passport documentation stays: origin and production data are always disclosed on request, even when the label is entirely yours.",
    },
  ];

  const logos = [
    "Hacienda Brands",
    "Colibrí Hotels",
    "Almanac Coffee",
    "Marabu Studio",
    "Terroir Foods",
  ];

  return (
    <div className="pt-14">
      <section
        className="bg-ink-cacao py-28 relative overflow-hidden"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1545567725-ab9b17093edc?w=1200&h=700&fit=crop&auto=format)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-ink-cacao/85" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="max-w-xl">
            <p className="font-sans text-[10px] tracking-[0.2em] text-sun-gold uppercase mb-6">
              B2B · Wholesale · Corporate
            </p>
            <h1 className="font-spectral text-5xl md:text-6xl text-paper-text font-semibold leading-[1.05] mb-6">
              Custom Chocolate, Crafted for Your Brand.
            </h1>
            <p className="font-spectral text-paper-text/70 text-lg leading-relaxed mb-10 max-w-md">
              We work with hotels, retailers, and gifting programmes that require traceability,
              consistency, and the kind of chocolate that holds its own on an expense account.
            </p>
            <button
              onClick={() => navigate("/wholesale/studio")}
              className="font-sans text-sm font-medium bg-sun-gold text-ink-cacao px-8 py-3.5 hover:bg-sun-gold/90 transition-colors"
            >
              Enter the Corporate Cacao Studio
            </button>
          </div>
        </div>
      </section>

      <section className="bg-ink-cacao border-t border-paper-text/10">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-paper-text/10">
            {features.map((f) => (
              <div key={f.title} className="px-0 md:px-10 py-10 md:py-0 first:pl-0 last:pr-0">
                <div className="text-paper-text/50 mb-5">{f.icon}</div>
                <h3 className="font-spectral text-xl text-paper-text font-semibold mb-3">
                  {f.title}
                </h3>
                <p className="font-sans text-sm text-paper-text/60 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-pod-wine py-14 border-t border-paper-text/5">
        <div className="max-w-7xl mx-auto px-6">
          <p className="font-sans text-[10px] tracking-[0.2em] text-paper-text/40 uppercase mb-8 text-center">
            Trusted by
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            {logos.map((l) => (
              <span key={l} className="font-spectral text-lg text-paper-text/30 italic">
                {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-stone-paper py-20 border-t border-ink-cacao">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-[2fr_3fr] gap-16 items-start">
            <div>
              <p className="font-sans text-[10px] tracking-[0.2em] text-ink-cacao/40 uppercase mb-4">
                How it works
              </p>
              <h2 className="font-spectral text-3xl font-semibold text-ink-cacao mb-5 leading-snug">
                A deliberate process for a deliberate product.
              </h2>
              <p className="font-spectral text-ink-cacao/70 leading-relaxed">
                Our B2B ordering flow takes most clients through four steps: profile selection,
                packaging, brand asset upload, and final quote review. Most quotes are returned
                within two business days.
              </p>
              <button
                onClick={() => navigate("/wholesale/studio")}
                className="mt-8 font-sans text-sm font-medium bg-ink-cacao text-stone-paper px-8 py-3.5 hover:bg-pod-wine transition-colors"
              >
                Start in the Studio →
              </button>
            </div>

            <div className="space-y-0">
              {[
                {
                  n: "01",
                  title: "Choose your cacao profile",
                  desc: "Origin, percentage, and tasting notes from our certified supplier network.",
                },
                {
                  n: "02",
                  title: "Select packaging & branding",
                  desc: "Rigid box, foil wrap, or specimen card insert. White label or co-branded.",
                },
                {
                  n: "03",
                  title: "Upload your brand assets",
                  desc: "PDF, AI, or PNG. We prepare a digital mockup within 48 hours.",
                },
                {
                  n: "04",
                  title: "Review & submit for quote",
                  desc: "Full itemised summary, and you can edit before submitting.",
                },
              ].map((step, i) => (
                <div
                  key={step.n}
                  className={`flex gap-6 py-6 ${i < 3 ? "border-b border-ink-cacao/15" : ""}`}
                >
                  <span className="font-mono text-xs text-ink-cacao/30 mt-0.5 shrink-0 w-8">
                    {step.n}
                  </span>
                  <div>
                    <p className="font-spectral text-base font-semibold text-ink-cacao mb-1">
                      {step.title}
                    </p>
                    <p className="font-sans text-xs text-ink-cacao/55 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-sun-gold py-16">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-spectral text-3xl text-ink-cacao font-semibold">
              Ready to build your chocolate programme?
            </h3>
            <p className="font-sans text-sm text-ink-cacao/70 mt-1">
              Most enquiries are answered within two business days.
            </p>
          </div>
          <button
            onClick={() => navigate("/wholesale/studio")}
            className="font-sans text-sm font-medium bg-ink-cacao text-stone-paper px-8 py-3.5 hover:bg-pod-wine transition-colors shrink-0"
          >
            Enter the Corporate Cacao Studio
          </button>
        </div>
      </section>
    </div>
  );
}
