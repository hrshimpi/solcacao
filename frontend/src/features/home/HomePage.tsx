import { useNavigate } from "react-router";
import { products } from "../../data/products";

export default function HomePage() {
  const navigate = useNavigate();
  const showcase = products.slice(0, 5);

  return (
    <div>
      <section
        className="relative min-h-screen bg-ink-cacao flex items-end pb-24 pt-14"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1743252878695-367d69dc87a8?w=1600&h=900&fit=crop&auto=format)",
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-ink-cacao/90 via-ink-cacao/70 to-ink-cacao/20" />

        <div className="relative max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-xl">
            <p className="reveal-up font-sans text-[10px] tracking-[0.2em] text-sun-gold uppercase mb-6">
              Single-origin · Direct trade · Field-documented
            </p>
            <h1 className="reveal-up font-spectral text-5xl md:text-6xl lg:text-7xl font-semibold text-paper-text leading-[1.05] mb-10">
              Grown in Sunlight,
              <br />
              Crafted with
              <br />
              Intention.
            </h1>
            <div className="reveal-up-delay flex flex-wrap gap-4">
              <button
                onClick={() => navigate("/shop")}
                className="font-sans text-sm font-medium bg-sun-gold text-ink-cacao px-8 py-3.5 hover:bg-sun-gold/90 transition-colors"
              >
                Shop the Collection
              </button>
              <button
                onClick={() => navigate("/wholesale")}
                className="font-sans text-sm font-medium border border-paper-text/40 text-paper-text px-8 py-3.5 hover:border-paper-text transition-colors"
              >
                Explore Wholesale
              </button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 border-t border-paper-text/10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-8 overflow-x-auto">
            {["Ecuador 72%", "Peru 68%", "Venezuela 76%", "Madagascar 80%"].map((label) => (
              <span
                key={label}
                className="font-sans text-[10px] text-paper-text/40 whitespace-nowrap"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-stone-paper py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-baseline justify-between mb-8 pb-4 border-b border-ink-cacao">
            <div>
              <h2 className="font-spectral text-2xl font-semibold text-ink-cacao">
                Seasonal showcase
              </h2>
              <p className="font-sans text-xs text-ink-cacao/50 mt-1">
                Current harvest, September 2024
              </p>
            </div>
            <button
              onClick={() => navigate("/shop")}
              className="font-sans text-xs text-ink-cacao/60 hover:text-ink-cacao underline underline-offset-2 transition-colors"
            >
              View all origins →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {showcase.map((product) => (
              <button
                key={product.id}
                onClick={() => navigate(`/shop/${product.slug}`)}
                className="border border-ink-cacao bg-stone-paper group text-left hover:bg-clay-surface transition-colors"
              >
                <div className="aspect-[3/4] overflow-hidden bg-clay-surface">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  />
                </div>
                <div className="p-3 border-t border-ink-cacao">
                  <p className="font-spectral text-sm font-semibold text-ink-cacao">
                    {product.name}
                  </p>
                  <p className="font-sans text-[10px] text-ink-cacao/55 mt-1 leading-snug">
                    {product.caption}
                  </p>
                  <p className="font-sans text-sm font-medium text-sun-gold mt-2.5">
                    ${product.price}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-pod-wine py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-[3fr_2fr] gap-16 items-center">
            <div>
              <p className="font-sans text-[10px] tracking-[0.2em] text-sun-gold uppercase mb-5">
                Our philosophy
              </p>
              <h2 className="font-spectral text-4xl md:text-5xl text-paper-text font-semibold mb-6 leading-snug">
                The cacao pod is a field document. We treat it that way.
              </h2>
              <p className="font-spectral text-paper-text/75 text-lg leading-relaxed mb-8 max-w-xl">
                Every bar we make carries a Batch Passport: origin farm, harvest date, fermentation
                method, roast profile. Not marketing copy. Documentation. Because when you eat
                chocolate made from fruit picked by hand in Esmeraldas or Barlovento, you deserve to
                know exactly where it grew and how it was handled.
              </p>
              <button
                onClick={() => navigate(`/shop/${products[0].slug}`)}
                className="font-sans text-sm text-paper-text border-b border-paper-text/40 hover:border-paper-text pb-0.5 transition-colors"
              >
                See a Batch Passport →
              </button>
            </div>
            <div
              className="aspect-[4/5] bg-ink-cacao"
              style={{
                backgroundImage:
                  "url(https://images.unsplash.com/photo-1507576164121-220762647800?w=700&h=875&fit=crop&auto=format)",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          </div>
        </div>
      </section>

      <section className="bg-stone-paper py-16 border-t border-ink-cacao">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
            {[
              { stat: "7", label: "Origin countries", sub: "Direct partnerships" },
              { stat: "40+", label: "Farming families", sub: "In our network" },
              { stat: "100%", label: "Direct trade", sub: "No intermediaries" },
              { stat: "64-80%", label: "Cacao range", sub: "Every bar, every batch" },
            ].map((item, i) => (
              <div
                key={item.stat}
                className={`py-8 px-6 ${i < 3 ? "border-r border-ink-cacao" : ""}`}
              >
                <p className="font-spectral text-4xl font-semibold text-pod-wine mb-1">
                  {item.stat}
                </p>
                <p className="font-sans text-sm text-ink-cacao font-medium">{item.label}</p>
                <p className="font-sans text-xs text-ink-cacao/50 mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink-cacao py-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <p className="font-sans text-[10px] tracking-[0.2em] text-sun-gold uppercase mb-3">
              Corporate &amp; wholesale
            </p>
            <h3 className="font-spectral text-3xl text-paper-text font-semibold max-w-md">
              Custom chocolate for your brand, produced at scale without compromise.
            </h3>
          </div>
          <button
            onClick={() => navigate("/wholesale")}
            className="font-sans text-sm font-medium bg-sun-gold text-ink-cacao px-8 py-3.5 hover:bg-sun-gold/90 transition-colors shrink-0"
          >
            Explore Wholesale
          </button>
        </div>
      </section>
    </div>
  );
}
