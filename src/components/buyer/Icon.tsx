/** Stroke icon (24×24 grid). `d` may hold several subpaths; extra shapes go in children. */
export function Icon({
  d,
  size = 20,
  strokeWidth = 1.8,
  children,
}: {
  d?: string;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {d && <path d={d} />}
      {children}
    </svg>
  );
}
