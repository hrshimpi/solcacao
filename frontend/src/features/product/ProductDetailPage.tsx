import { useState } from "react";
import { Link, useParams } from "react-router";
import { Product } from "../../types";
import { products } from "../../data/products";
import { useCart } from "../cart/CartContext";
import NotFoundPage from "../shell/NotFoundPage";

interface ProductDetailProps {
  product: Product;
}

function OriginMap() {
  return (
    <svg viewBox="0 0 320 180" className="w-full opacity-60" fill="none">
      <path
        d="M45 40 L80 35 L95 55 L85 75 L70 90 L55 85 L40 70 Z"
        stroke="#F3ECDD"
        strokeWidth="0.8"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M75 98 L95 92 L105 110 L100 140 L85 155 L70 145 L65 120 Z"
        stroke="#F3ECDD"
        strokeWidth="0.8"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M135 32 L160 28 L168 45 L155 55 L140 50 Z"
        stroke="#F3ECDD"
        strokeWidth="0.8"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M145 60 L175 55 L185 80 L180 120 L160 135 L140 120 L135 90 Z"
        stroke="#F3ECDD"
        strokeWidth="0.8"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M185 30 L250 25 L265 50 L255 75 L220 80 L190 65 L180 45 Z"
        stroke="#F3ECDD"
        strokeWidth="0.8"
        fill="none"
        opacity="0.5"
      />
      <circle cx="82" cy="108" r="3" fill="#EFA836" />
      <circle cx="88" cy="102" r="3" fill="#EFA836" opacity="0.7" />
      <circle cx="78" cy="115" r="2" fill="#EFA836" opacity="0.5" />
      <circle cx="165" cy="98" r="3" fill="#EFA836" opacity="0.6" />
      <line x1="0" y1="90" x2="320" y2="90" stroke="#F3ECDD" strokeWidth="0.4" strokeDasharray="3 4" opacity="0.2" />
      <text x="305" y="87" fontSize="7" fill="#F3ECDD" opacity="0.3" fontFamily="IBM Plex Mono">EQ</text>
    </svg>
  );
}

export default function ProductDetailPage() {
  const { slug } = useParams();
  const product = products.find((p) => p.slug === slug);

  if (!product) return <NotFoundPage />;
  return <ProductDetail product={product} />;
}

function ProductDetail({ product }: ProductDetailProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  const images = [product.image, product.image.replace("w=480", "w=480&crop=top"), product.image.replace("fit=crop", "fit=crop&crop=bottom")];

  return (
    <div className="bg-stone-paper min-h-screen pt-14">
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center gap-2 border-b border-ink-cacao/15">
        <Link to="/" className="font-sans text-[10px] text-ink-cacao/50 hover:text-ink-cacao transition-colors">
          Home
        </Link>
        <span className="text-ink-cacao/30 text-[10px]">/</span>
        <Link to="/shop" className="font-sans text-[10px] text-ink-cacao/50 hover:text-ink-cacao transition-colors">
          Shop
        </Link>
        <span className="text-ink-cacao/30 text-[10px]">/</span>
        <span className="font-sans text-[10px] text-ink-cacao">{product.name}</span>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-[3fr_2fr] gap-12 lg:gap-16">
        <div className="space-y-3">
          <div className="aspect-[4/5] bg-clay-surface border border-ink-cacao overflow-hidden">
            <img
              src={images[activeImage]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex gap-3">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`w-20 h-24 border overflow-hidden shrink-0 transition-colors ${
                  activeImage === i ? "border-ink-cacao" : "border-ink-cacao/30 hover:border-ink-cacao/60"
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <p className="font-sans text-[10px] tracking-[0.2em] text-ink-cacao/40 uppercase mb-3">
            {product.origin} · {product.category}
          </p>
          <h1 className="font-spectral text-4xl font-semibold text-ink-cacao mb-1">
            {product.name}
          </h1>
          <p className="font-sans text-2xl font-medium text-sun-gold mb-6">
            ${product.price}
          </p>

          <p className="font-spectral text-base text-ink-cacao/80 leading-relaxed mb-6">
            {product.description}
          </p>

          <div className="mb-6 border-t border-ink-cacao/15 pt-5">
            <p className="font-sans text-[10px] font-medium tracking-widest text-ink-cacao/40 uppercase mb-3">
              Tasting notes
            </p>
            <p className="font-spectral text-sm text-ink-cacao">
              {product.notes.join(", ")}: {product.tastingSummary}
            </p>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center border border-ink-cacao">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="font-sans text-sm px-4 py-2.5 text-ink-cacao hover:bg-clay-surface transition-colors"
              >
                -
              </button>
              <span className="font-sans text-sm px-4 py-2.5 border-x border-ink-cacao min-w-[3rem] text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="font-sans text-sm px-4 py-2.5 text-ink-cacao hover:bg-clay-surface transition-colors"
              >
                +
              </button>
            </div>
            <button
              onClick={() => addItem(product, quantity)}
              className="flex-1 font-sans text-sm font-medium bg-sun-gold text-ink-cacao py-2.5 hover:bg-sun-gold/90 transition-colors"
            >
              Add to cart
            </button>
          </div>

          <div className="border border-ink-cacao bg-clay-surface p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-ink-cacao/20">
              <div>
                <p className="font-sans text-[9px] tracking-[0.2em] text-ink-cacao/50 uppercase">
                  Batch passport
                </p>
                <p className="font-mono text-sm font-medium text-ink-cacao mt-0.5">
                  {product.batchCode}
                </p>
              </div>
              <div className="border border-ink-cacao/30 p-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-ink-cacao/40">
                  <rect x="3" y="3" width="18" height="18" rx="0" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                { label: "Harvest date", value: product.harvestDate },
                { label: "Roast date", value: product.roastDate },
                { label: "Farm / origin", value: product.farm },
                { label: "Cacao %", value: `${product.percentage}%` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="font-sans text-[9px] tracking-widest text-ink-cacao/40 uppercase">
                    {label}
                  </p>
                  <p className="font-spectral text-xs text-ink-cacao mt-0.5 leading-snug">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-canopy-green" />
            <p className="font-sans text-[10px] text-canopy-green">
              Certified organic · Direct trade
            </p>
          </div>
        </div>
      </div>

      <section className="bg-ink-cacao mt-4">
        <div className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-[2fr_3fr] gap-16 items-center">
          <div>
            <OriginMap />
            <p className="font-sans text-[10px] text-paper-text/30 mt-4 text-center">
              {product.origin}, growing region
            </p>
          </div>
          <div>
            <p className="font-sans text-[10px] tracking-[0.2em] text-sun-gold uppercase mb-4">
              Origin story
            </p>
            <h2 className="font-spectral text-3xl text-paper-text font-semibold mb-5 leading-snug">
              {product.farm}
            </h2>
            <p className="font-spectral text-paper-text/70 text-base leading-relaxed mb-6">
              {product.description} The beans are transported within 48 hours of harvest to a central fermentation station, where they spend between five and nine days under controlled conditions before being dried on raised mesh beds exposed to direct equatorial sunlight.
            </p>
            <p className="font-spectral text-paper-text/70 text-base leading-relaxed">
              Our relationship with this farm began in 2019. Every year we return for the harvest, not as buyers but as witnesses. The flavors in this bar are the flavors of this particular soil, this particular season, these particular hands.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
