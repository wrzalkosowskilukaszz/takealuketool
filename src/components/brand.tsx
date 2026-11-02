/** The Take a Luke Studio mark: an "L" and a looking dot, on the green tile. */
export function BrandLogo({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-logo-svg">
      <defs>
        <linearGradient id="brand-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0e9a69" />
          <stop offset="1" stopColor="#1fca8c" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#brand-g)" />
      <rect x="9" y="8" width="3.2" height="16" rx="1.6" fill="#fff" />
      <rect x="9" y="20.8" width="12" height="3.2" rx="1.6" fill="#fff" />
      <circle cx="21" cy="11.5" r="3" fill="#fff" fillOpacity="0.7" />
    </svg>
  );
}

export function Brand() {
  return (
    <span className="brand">
      <BrandLogo />
      <span>
        <span className="brand-mark">Take a Luke</span>
        <span className="brand-sub">Studio</span>
      </span>
    </span>
  );
}
