import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Building2, Landmark, Mountain, TrainFront, Trees, Waves } from 'lucide-react';
import type { Category } from '@hk/contracts';

export function IconButton({
  label,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

const icons = {
  landmark: Mountain,
  park: Trees,
  waterfront: Waves,
  culture: Landmark,
  station: TrainFront,
};
export function PlaceIcon({ category, size = 20 }: { category?: Category; size?: number }) {
  const Icon = category ? icons[category] : Building2;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}

export function HongKongMark() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect width="48" height="48" rx="14" fill="currentColor" />
      <path
        d="m12 33 7-20 5 12 5-8 7 16M12 33h24"
        stroke="var(--lime)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
