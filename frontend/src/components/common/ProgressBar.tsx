import { clsx } from 'clsx';

interface ProgressBarProps {
  progress: number; // 0-1
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

export function ProgressBar({ progress, label, showPercentage = true, className }: ProgressBarProps) {
  const percentage = Math.round(progress * 100);

  return (
    <div className={clsx('w-full', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between mb-1 text-sm text-gray-600">
          {label && <span>{label}</span>}
          {showPercentage && <span>{percentage}%</span>}
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="bg-blue-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
