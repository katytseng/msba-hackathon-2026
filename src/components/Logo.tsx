/** Landfall mark: a shipping box with a tariff (%) badge. Decorative; pair it with the word "Landfall". */
export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} fill="none" aria-hidden="true" focusable="false" className={className}>
      <polygon points="48,8 88,28 48,48 8,28" fill="#ecc994" />
      <polygon points="8,28 48,48 48,88 8,68" fill="#c99a5b" />
      <polygon points="48,48 88,28 88,68 48,88" fill="#a67a42" />
      <polygon points="23.2,20.4 32.8,15.6 72.8,35.6 63.2,40.4" fill="#f6ead2" />
      <polygon points="63.2,40.4 72.8,35.6 72.8,55.6 63.2,60.4" fill="#e6d3ac" />
      <polygon points="16,46 34,55 34,69 16,60" fill="#fff6e3" />
      <path d="M19.2 51.6l11.6 5.8M19.2 56.8l11.6 5.8" stroke="#a67a42" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M48 8 88 28v40L48 88 8 68V28z" stroke="#7a5628" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M8 28l40 20 40-20M48 48v40" stroke="#7a5628" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="78" cy="76" r="16" fill="#f28c0a" stroke="#ffffff" strokeWidth="3" />
      <text x="78" y="84.5" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="24" fill="#14284b">
        %
      </text>
    </svg>
  )
}

export const TAGLINE = 'One stop for small importers: landed cost, tariffs, and cash.'

/** Mark plus wordmark, and optionally the tagline. */
export function Logo({ size = 40, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <LogoMark size={size} className="shrink-0" />
      <span className="flex flex-col">
        <span className="text-xl leading-tight font-extrabold tracking-tight text-ink">Landfall</span>
        {tagline && <span className="text-small text-muted">{TAGLINE}</span>}
      </span>
    </span>
  )
}
