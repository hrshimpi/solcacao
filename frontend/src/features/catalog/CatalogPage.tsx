import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { products } from "../../data/products";
import { useCart } from "../cart/CartContext";

const FLAVOR_NOTES = ["Fruity", "Nutty", "Floral", "Earthy", "Smoky"];

function FlavorCompass({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (n: string) => void;
}) {
  const cx = 75;
  const cy = 75;
  const r = 48;
  const lr = 64;

  const notes = FLAVOR_NOTES.map((note, i) => {
    const angleDeg = i * 72 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x2 = cx + r * Math.cos(angleRad);
    const y2 = cy + r * Math.sin(angleRad);
    const lx = cx + lr * Math.cos(angleRad);
    const ly = cy + lr * Math.sin(angleRad);
    const isSelected = selected.includes(note);
    return { note, x2, y2, lx, ly, isSelected };
  });

  return (
    <svg
      viewBox="0 0 150 150"
      className="w-full max-w-[160px] mx-auto block"
      style={{ overflow: "visible" }}
    >
      {[20, 35].map((rr) => (
        <circle
          key={rr}
          cx={cx}
          cy={cy}
          r={rr}
          fill="none"
          stroke="#1C1310"
          strokeWidth="0.5"
          opacity="0.12"
        />
      ))}
      <circle cx={cx} cy={cy} r="3" fill="#1C1310" opacity="0.3" />

      {notes.map(({ note, x2, y2, lx, ly, isSelected }) => (
        <g
          key={note}
          onClick={() => onToggle(note)}
          className="cursor-pointer"
          role="button"
          aria-pressed={isSelected}
        >
          <line
            x1={cx}
            y1={cy}
            x2={x2}
            y2={y2}
            stroke={isSelected ? "#6B1F2E" : "#1C1310"}
            strokeWidth={isSelected ? 1.5 : 0.8}
            opacity={isSelected ? 1 : 0.3}
          />
          <circle
            cx={x2}
            cy={y2}
            r={isSelected ? 4 : 2.5}
            fill={isSelected ? "#6B1F2E" : "transparent"}
            stroke={isSelected ? "#6B1F2E" : "#1C1310"}
            strokeWidth="1"
            opacity={isSelected ? 1 : 0.35}
          />
          <text
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="8.5"
            fontFamily="IBM Plex Sans, sans-serif"
            fill={isSelected ? "#6B1F2E" : "#1C1310"}
            opacity={isSelected ? 1 : 0.45}
            style={{ userSelect: "none" }}
          >
            {note}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function CatalogPage() {
  const navigate = useNavigate();
  const { items: cart, count: cartCount, addItem, open: openCart } = useCart();
  const [minPct, setMinPct] = useState(60);
  const [maxPct, setMaxPct] = useState(85);
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  const origins = [...new Set(products.map((p) => p.origin))];
  const categories = ["All", "Bars", "Truffles", "Seasonal"];

  const toggleOrigin = (o: string) =>
    setSelectedOrigins((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));

  const toggleFlavor = (n: string) =>
    setSelectedFlavors((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        if (p.percentage < minPct || p.percentage > maxPct) return false;
        if (selectedOrigins.length && !selectedOrigins.includes(p.origin)) return false;
        if (selectedCategory !== "All" && p.category !== selectedCategory) return false;
        if (selectedFlavors.length && !selectedFlavors.some((f) => p.notes.includes(f)))
          return false;
        return true;
      }),
    [products, minPct, maxPct, selectedOrigins, selectedCategory, selectedFlavors],
  );

  const sidebar = (
    <aside className="w-full space-y-7">
      <div className="border-b border-ink-cacao/15 pb-6">
        <p className="font-sans text-[10px] font-medium tracking-widest text-ink-cacao/50 uppercase mb-4">
          Cacao percentage
        </p>
        <div className="space-y-3">
          <div className="flex justify-between font-mono text-xs text-ink-cacao">
            <span>{minPct}%</span>
            <span>{maxPct}%</span>
          </div>
          <input
            type="range"
            min={55}
            max={85}
            value={minPct}
            onChange={(e) => setMinPct(Math.min(Number(e.target.value), maxPct - 2))}
          />
          <input
            type="range"
            min={55}
            max={85}
            value={maxPct}
            onChange={(e) => setMaxPct(Math.max(Number(e.target.value), minPct + 2))}
          />
        </div>
      </div>

      <div className="border-b border-ink-cacao/15 pb-6">
        <p className="font-sans text-[10px] font-medium tracking-widest text-ink-cacao/50 uppercase mb-4">
          Origin
        </p>
        <div className="space-y-2">
          {origins.map((o) => (
            <label key={o} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedOrigins.includes(o)}
                onChange={() => toggleOrigin(o)}
                className="sr-only"
              />
              <span
                className={`w-3.5 h-3.5 border border-ink-cacao flex items-center justify-center shrink-0 transition-colors ${
                  selectedOrigins.includes(o) ? "bg-pod-wine border-pod-wine" : "bg-transparent"
                }`}
              >
                {selectedOrigins.includes(o) && (
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                  >
                    <path d="M1.5 5 L4 7.5 L8.5 2.5" strokeLinecap="round" />
                  </svg>
                )}
              </span>
              <span className="font-sans text-xs text-ink-cacao group-hover:text-pod-wine transition-colors">
                {o}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-b border-ink-cacao/15 pb-6">
        <p className="font-sans text-[10px] font-medium tracking-widest text-ink-cacao/50 uppercase mb-4">
          Category
        </p>
        <div className="flex flex-col gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`font-sans text-xs text-left px-0 py-0.5 transition-colors ${
                selectedCategory === c
                  ? "text-pod-wine font-medium"
                  : "text-ink-cacao/60 hover:text-ink-cacao"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="font-sans text-[10px] font-medium tracking-widest text-ink-cacao/50 uppercase mb-4">
          Flavor compass
        </p>
        <FlavorCompass selected={selectedFlavors} onToggle={toggleFlavor} />
        {selectedFlavors.length > 0 && (
          <button
            onClick={() => setSelectedFlavors([])}
            className="mt-2 font-sans text-[10px] text-ink-cacao/40 underline hover:text-ink-cacao transition-colors block mx-auto"
          >
            Clear
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <div className="bg-stone-paper min-h-screen pt-14">
      <div className="max-w-7xl mx-auto px-6 py-10 border-b border-ink-cacao">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-spectral text-4xl font-semibold text-ink-cacao">The collection</h1>
            <p className="font-sans text-xs text-ink-cacao/50 mt-1.5">
              {filtered.length} specimen{filtered.length !== 1 ? "s" : ""} · September 2024 harvest
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="md:hidden font-sans text-xs border border-ink-cacao px-4 py-2 text-ink-cacao hover:bg-clay-surface transition-colors"
            >
              Filters
            </button>
            <button
              onClick={openCart}
              className="relative font-sans text-xs border border-ink-cacao px-4 py-2 text-ink-cacao hover:bg-clay-surface transition-colors"
            >
              Cart
              {cart.length > 0 && (
                <span className="ml-2 bg-sun-gold text-ink-cacao text-[9px] font-semibold px-1.5 py-0.5">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 flex gap-12">
        <div className="hidden md:block w-52 shrink-0 pt-1">{sidebar}</div>

        {filterOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="absolute inset-0 bg-ink-cacao/40"
              onClick={() => setFilterOpen(false)}
            />
            <div className="relative w-72 bg-stone-paper h-full overflow-y-auto px-6 py-8 slide-in-left">
              <div className="flex items-center justify-between mb-6">
                <p className="font-spectral text-xl font-semibold">Filters</p>
                <button onClick={() => setFilterOpen(false)}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <line x1="18" x2="6" y1="6" y2="18" />
                    <line x1="6" x2="18" y1="6" y2="18" />
                  </svg>
                </button>
              </div>
              {sidebar}
            </div>
          </div>
        )}

        <div className="flex-1">
          {filtered.length === 0 ? (
            <div className="border border-ink-cacao p-16 text-center">
              <p className="font-spectral text-xl text-ink-cacao/60">
                No specimens match these filters.
              </p>
              <button
                onClick={() => {
                  setMinPct(60);
                  setMaxPct(85);
                  setSelectedOrigins([]);
                  setSelectedCategory("All");
                  setSelectedFlavors([]);
                }}
                className="mt-4 font-sans text-xs underline text-ink-cacao/50 hover:text-ink-cacao"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((product) => (
                <div key={product.id} className="border border-ink-cacao bg-stone-paper group">
                  <button
                    onClick={() => navigate(`/shop/${product.slug}`)}
                    className="block w-full text-left"
                  >
                    <div className="aspect-[3/4] overflow-hidden bg-clay-surface">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                      />
                    </div>
                  </button>
                  <div className="p-4 border-t border-ink-cacao">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <button
                        onClick={() => navigate(`/shop/${product.slug}`)}
                        className="font-spectral text-sm font-semibold text-ink-cacao text-left hover:text-pod-wine transition-colors"
                      >
                        {product.name}
                      </button>
                      <span className="font-sans text-sm font-medium text-sun-gold shrink-0">
                        ${product.price}
                      </span>
                    </div>
                    <p className="font-sans text-[10px] text-ink-cacao/55 leading-snug mb-3">
                      {product.caption}
                    </p>
                    <button
                      onClick={() => addItem(product)}
                      className="w-full font-sans text-[11px] font-medium border border-ink-cacao text-ink-cacao py-2 hover:bg-ink-cacao hover:text-stone-paper transition-colors"
                    >
                      Add to cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
