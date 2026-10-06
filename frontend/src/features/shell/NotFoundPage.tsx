import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="pt-14 min-h-screen bg-stone-paper">
      <div className="max-w-3xl mx-auto px-6 py-24">
        <p className="font-mono text-xs text-ink-cacao/40 mb-4">404</p>
        <h1 className="font-spectral text-4xl font-semibold text-ink-cacao mb-4">
          We couldn't find that page.
        </h1>
        <p className="font-spectral text-ink-cacao/70 mb-8">
          The link may be old, or the product may no longer be in the collection.
        </p>
        <div className="flex gap-6 font-sans text-sm">
          <Link to="/" className="underline underline-offset-4 text-ink-cacao hover:text-pod-wine">
            Back to the home page
          </Link>
          <Link
            to="/shop"
            className="underline underline-offset-4 text-ink-cacao hover:text-pod-wine"
          >
            Browse the shop
          </Link>
        </div>
      </div>
    </div>
  );
}
