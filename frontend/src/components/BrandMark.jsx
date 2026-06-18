// HyperShopIndia logo mark — a stylized "M" arrow in orange / teal / red.
// Recreated as SVG so it stays crisp at any size and works on light or dark.
export default function BrandMark({ size = 32, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      {/* orange: left bar + diagonal down to centre */}
      <path d="M14 50 L14 18 L32 38" stroke="#FB6A14" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      {/* teal: diagonal up to right bar */}
      <path d="M32 38 L50 18 L50 50" stroke="#10A578" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      {/* red: lower-left diagonal accent */}
      <path d="M20 30 L33 43" stroke="#F0231E" strokeWidth="7.5" strokeLinecap="round" />
    </svg>
  );
}
