import { useState } from "react";
import { Product } from "../../types";
import { products } from "../../data/products";
import { useCart } from "../cart/CartContext";

const MIN_PIECES = 4;
const MAX_PIECES = 6;

const CONTACT_CATEGORIES = ["General", "Wholesale", "Support"];

const TRAY_POSITIONS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 2, y: 1 },
];

export default function SamplerPage() {
  const { addItem } = useCart();
  const [selected, setSelected] = useState<Product[]>([]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [contactData, setContactData] = useState({
    category: "General",
    name: "",
    email: "",
    message: "",
  });

  const toggleProduct = (p: Product) => {
    if (selected.find((s) => s.id === p.id)) {
      setSelected(selected.filter((s) => s.id !== p.id));
    } else if (selected.length < MAX_PIECES) {
      setSelected([...selected, p]);
    }
  };

  const isSelected = (p: Product) => selected.some((s) => s.id === p.id);
  const canAdd = selected.length < MAX_PIECES;
  const isComplete = selected.length >= MIN_PIECES;

  const handleAddSamplerToCart = () => {
    selected.forEach((p) => addItem(p));
  };

  return (
    <div className="pt-14 bg-stone-paper min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-10 border-b border-ink-cacao">
        <h1 className="font-spectral text-4xl font-semibold text-ink-cacao">
          Build your own sampler
        </h1>
        <p className="font-sans text-xs text-ink-cacao/50 mt-2">
          Choose {MIN_PIECES} to {MAX_PIECES} specimens. The selection will be arranged and boxed as
          a tasting set.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-[3fr_2fr] gap-12">
        <div>
          <p className="font-sans text-[10px] tracking-widest text-ink-cacao/40 uppercase mb-6">
            Select specimens · {selected.length}/{MAX_PIECES} chosen
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
            {products.map((p) => {
              const sel = isSelected(p);
              const disabled = !sel && !canAdd;
              return (
                <div key={p.id} className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => !disabled && toggleProduct(p)}
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    disabled={disabled}
                    className={`relative w-full aspect-square rounded-full overflow-hidden border-2 transition-all ${
                      sel
                        ? "border-pod-wine scale-105"
                        : disabled
                          ? "border-ink-cacao/10 opacity-30"
                          : "border-ink-cacao/20 hover:border-ink-cacao/60 hover:scale-[1.02]"
                    }`}
                  >
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    {sel && (
                      <div className="absolute inset-0 bg-pod-wine/25 flex items-center justify-center">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        >
                          <path d="M5 12 L10 17 L19 7" />
                        </svg>
                      </div>
                    )}
                    {hoveredId === p.id && !sel && !disabled && (
                      <div className="absolute inset-0 bg-ink-cacao/70 flex items-center justify-center">
                        <span className="font-sans text-[9px] text-paper-text font-medium">+</span>
                      </div>
                    )}
                  </button>
                  <div className="text-center">
                    <p className="font-spectral text-[11px] font-semibold text-ink-cacao leading-tight">
                      {p.name}
                    </p>
                    {hoveredId === p.id && (
                      <p className="font-sans text-[9px] text-ink-cacao/50 mt-0.5 leading-snug">
                        {p.notes.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="font-sans text-[10px] tracking-widest text-ink-cacao/40 uppercase mb-6">
            Your sampler tray
          </p>

          <div className="border-2 border-pod-wine bg-clay-surface p-6 mb-6">
            <div className="grid grid-cols-3 gap-3">
              {TRAY_POSITIONS.map((pos, i) => {
                const item = selected[i];
                return (
                  <div
                    key={`${pos.x}-${pos.y}`}
                    className={`aspect-square border transition-all ${
                      item
                        ? "border-pod-wine/50 overflow-hidden"
                        : "border-dashed border-ink-cacao/20"
                    }`}
                  >
                    {item ? (
                      <div className="relative w-full h-full">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-ink-cacao/40 flex items-end p-1.5">
                          <p className="font-sans text-[8px] text-paper-text leading-tight">
                            {item.name}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="font-sans text-[10px] text-ink-cacao/20">{i + 1}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selected.length > 0 && (
              <div className="mt-4 border-t border-ink-cacao/15 pt-4 space-y-1.5">
                {selected.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <p className="font-spectral text-xs text-ink-cacao">{p.name}</p>
                    <p className="font-sans text-xs text-sun-gold">${p.price}</p>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-ink-cacao/15 pt-2 mt-2">
                  <p className="font-sans text-[10px] text-ink-cacao/50">Total</p>
                  <p className="font-sans text-sm font-medium text-ink-cacao">
                    ${selected.reduce((s, p) => s + p.price, 0)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {selected.length < MIN_PIECES && (
            <p className="font-sans text-[10px] text-ink-cacao/40 text-center mb-4">
              Select {MIN_PIECES - selected.length} more to complete your sampler
            </p>
          )}

          <button
            onClick={handleAddSamplerToCart}
            disabled={!isComplete}
            className="w-full font-sans text-sm font-medium bg-sun-gold text-ink-cacao py-3.5 hover:bg-sun-gold/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Add sampler to cart
          </button>
        </div>
      </div>

      <div className="border-t border-ink-cacao bg-stone-paper">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h2 className="font-spectral text-3xl font-semibold text-ink-cacao mb-2">Get in touch</h2>
          <p className="font-spectral text-ink-cacao/60 mb-10">
            Questions about your order, wholesale enquiries, or general correspondence.
          </p>

          {submitted ? (
            <div className="border border-ink-cacao/20 bg-clay-surface p-10 text-center">
              <p className="font-spectral text-xl text-ink-cacao font-semibold mb-2">
                Message received.
              </p>
              <p className="font-spectral text-ink-cacao/60">
                We typically respond within one business day.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="font-sans text-[9px] tracking-widest text-ink-cacao/40 uppercase block mb-3">
                  Category
                </label>
                <div className="flex gap-4">
                  {CONTACT_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setContactData((d) => ({ ...d, category: cat }))}
                      className={`font-sans text-xs pb-0.5 transition-colors ${
                        contactData.category === cat
                          ? "text-ink-cacao border-b border-ink-cacao"
                          : "text-ink-cacao/40 hover:text-ink-cacao/70"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { key: "name", label: "Name", placeholder: "Isabel Vásquez", type: "text" },
                  { key: "email", label: "Email", placeholder: "you@domain.com", type: "email" },
                ].map(({ key, label, placeholder, type }) => (
                  <div
                    key={key}
                    className="border-b border-ink-cacao/25 focus-within:border-pod-wine transition-colors pb-1"
                  >
                    <label className="font-sans text-[9px] tracking-widest text-ink-cacao/40 uppercase block mb-1">
                      {label}
                    </label>
                    <input
                      type={type}
                      value={contactData[key as "name" | "email"]}
                      onChange={(e) => setContactData((d) => ({ ...d, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full font-sans text-sm text-ink-cacao bg-transparent focus:outline-none placeholder-ink-cacao/25"
                    />
                  </div>
                ))}
              </div>

              <div className="border-b border-ink-cacao/25 focus-within:border-pod-wine transition-colors pb-1">
                <label className="font-sans text-[9px] tracking-widest text-ink-cacao/40 uppercase block mb-1">
                  Message
                </label>
                <textarea
                  value={contactData.message}
                  onChange={(e) => setContactData((d) => ({ ...d, message: e.target.value }))}
                  rows={5}
                  placeholder="Your message..."
                  className="w-full font-sans text-sm text-ink-cacao bg-transparent focus:outline-none placeholder-ink-cacao/25 resize-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSubmitted(true)}
                  className="font-sans text-sm font-medium bg-sun-gold text-ink-cacao px-8 py-3 hover:bg-sun-gold/90 transition-colors"
                >
                  Send message
                </button>

                <a
                  href="https://wa.me/15551234567"
                  className="flex items-center gap-2 font-sans text-xs text-ink-cacao/50 hover:text-ink-cacao transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="text-canopy-green"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
