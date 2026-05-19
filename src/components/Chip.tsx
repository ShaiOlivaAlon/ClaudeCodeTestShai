import clsx from 'clsx';
import { X } from 'lucide-react';

interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export default function Chip({ label, active, onClick, onRemove, size = 'md' }: ChipProps) {
  return (
    <span
      onClick={onClick}
      className={clsx(
        'chip',
        active && 'chip-active',
        size === 'sm' && 'px-2.5 py-1 text-[11px]'
      )}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          className="text-ink-300 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
