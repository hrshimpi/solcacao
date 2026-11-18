// The heading of one of the steps of the checkout: a number and a title, with a line under it.
export default function StepHeading({ id, number, title }: { id: string; number: number; title: string }) {
  return (
    <h2 id={id} className="mb-6 flex items-baseline gap-3 border-b border-ink-cacao pb-3 font-spectral text-2xl font-semibold text-ink-cacao">
      <span aria-hidden="true" className="font-sans text-xs tracking-widest text-pod-wine">
        {String(number).padStart(2, "0")}
      </span>
      {title}
    </h2>
  );
}
