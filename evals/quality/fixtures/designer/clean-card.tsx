// Designer fixture: clean card with proper tokens, semantics, and a11y
// Expected: high score (≥ 80), minimal violations

interface CardProps {
  title: string;
  description: string;
  onClose: () => void;
}

export default function CleanCard({ title, description, onClose }: CardProps) {
  return (
    <article className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <button
          aria-label="Close card"
          onClick={onClose}
          className="rounded-md p-1 text-neutral-500 hover:text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
      <p className="mt-2 text-sm text-neutral-600">{description}</p>
    </article>
  );
}
