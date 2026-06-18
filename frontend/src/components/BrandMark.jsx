// HyperShopIndia logo mark.
// Prefers the real logo image at /logo.png (drop it in frontend/public/).
// Falls back to an inline SVG approximation if the image isn't present.
import { useState } from 'react';

export default function BrandMark({ size = 32, className = '' }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!imgFailed) {
    return (
      <img
        src="/logo.png"
        alt="HyperShopIndia"
        width={size}
        height={size}
        className={className}
        style={{ objectFit: 'contain', display: 'block' }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <path d="M30 17 L20 9 L20 38" stroke="#FB6A14" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 38 L33 58" stroke="#F0231E" strokeWidth="7.5" strokeLinecap="round" />
      <path d="M36 56 L44 60 L44 26 L31 8" stroke="#10A578" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
