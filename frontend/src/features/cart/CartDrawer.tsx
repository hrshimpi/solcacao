import { useState } from "react";
import { useCart } from "./CartContext";

export default function CartDrawer() {
  const { items, subtotal, isOpen, close, setQuantity, removeItem } = useCart();
  const [showCheckoutNote, setShowCheckoutNote] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-cacao/40" onClick={close} />
      <div
        role="dialog"
        aria-label="Your cart"
        className="relative w-80 bg-ink-cacao h-full flex flex-col slide-in-right"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-paper-text/10">
          <p className="font-spectral text-lg text-paper-text">Your cart</p>
          <button
            onClick={close}
            aria-label="Close cart"
            className="text-paper-text/60 hover:text-paper-text transition-colors"
          >
            <svg
              width="18"
              height="18"
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

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {items.length === 0 ? (
            <p className="font-spectral text-paper-text/40 text-sm mt-8 text-center">
              No items yet.
            </p>
          ) : (
            items.map((item) => (
              <div key={item.product.id} className="border-b border-paper-text/10 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-spectral text-sm text-paper-text font-semibold">
                      {item.product.name}
                    </p>
                    <p className="font-sans text-[10px] text-paper-text/50 mt-0.5">
                      {item.product.caption}
                    </p>
                  </div>
                  <p className="font-sans text-sm text-sun-gold font-medium shrink-0">
                    ${item.product.price * item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center border border-paper-text/20">
                    <button
                      onClick={() => setQuantity(item.product.id, item.quantity - 1)}
                      aria-label={`Remove one ${item.product.name}`}
                      className="font-sans text-sm text-paper-text/70 px-3 py-1 hover:text-paper-text transition-colors"
                    >
                      -
                    </button>
                    <span className="font-sans text-xs text-paper-text px-2 border-x border-paper-text/20">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(item.product.id, item.quantity + 1)}
                      aria-label={`Add one ${item.product.name}`}
                      className="font-sans text-sm text-paper-text/70 px-3 py-1 hover:text-paper-text transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.product.id)}
                    className="font-sans text-[10px] text-paper-text/30 underline hover:text-paper-text/60 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="px-6 py-6 border-t border-paper-text/10">
            <div className="flex justify-between mb-4">
              <span className="font-sans text-xs text-paper-text/50">Subtotal</span>
              <span className="font-sans text-lg font-medium text-sun-gold">
                ${subtotal.toFixed(2)}
              </span>
            </div>
            <button
              onClick={() => setShowCheckoutNote(true)}
              className="w-full font-sans text-sm font-medium bg-sun-gold text-ink-cacao py-3.5 hover:bg-sun-gold/90 transition-colors"
            >
              Checkout
            </button>
            <p className="font-sans text-[10px] text-paper-text/40 text-center mt-3">
              {showCheckoutNote
                ? "Online checkout isn't available yet. Your cart is kept while you browse."
                : "Shipping calculated at checkout"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
