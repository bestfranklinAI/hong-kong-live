import { navigationPaths, type NavigationSymbol } from './navigation-symbols';
export function NavigationIcon({ kind }: { kind: NavigationSymbol }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {navigationPaths[kind].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
