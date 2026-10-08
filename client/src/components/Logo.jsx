// Softium mark: five rounded squares, the middle one in the brand orange.
// The dark squares use currentColor, so the logo is dark on the light theme and light on the dark theme.
export default function Logo({ size = 32, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`softium-logo ${className}`} role="img" aria-label="Softium">
      <rect x="9" y="0" width="6" height="6" rx="1" fill="currentColor" />
      <rect x="18" y="0" width="6" height="6" rx="1" fill="currentColor" />
      <rect x="9" y="9" width="6" height="6" rx="1" fill="#E8601C" />
      <rect x="0" y="18" width="6" height="6" rx="1" fill="currentColor" />
      <rect x="9" y="18" width="6" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}
