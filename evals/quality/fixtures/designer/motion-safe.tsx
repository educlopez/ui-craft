// Designer fixture: animation with prefers-reduced-motion guard
// Expected: high score (≥ 80) — animation is properly guarded

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export default function MotionSafeToast({ message, onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-lg motion-safe:animate-[fadeIn_0.2s_ease-out]"
      style={{
        // Respects prefers-reduced-motion via CSS media query below
      }}
    >
      <p className="text-sm text-neutral-700">{message}</p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="ml-auto rounded p-1 text-neutral-400 hover:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .motion-safe\\:animate-\\[fadeIn_0\\.2s_ease-out\\] {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
