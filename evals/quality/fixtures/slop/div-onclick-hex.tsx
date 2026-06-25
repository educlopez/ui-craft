// Slop fixture: div onClick (non-semantic interactive) + raw hex + positive tabindex + transition-all
// Expected: a11y violations + token violations + anti-slop → score well below 80

export default function ClickableCard({ onClick }: { onClick: () => void }) {
  return (
    <section
      style={{ backgroundColor: '#7c3aed', color: '#f3f4f6', borderRadius: '12px' }}
      className="transition-all duration-300"
    >
      {/* Non-semantic interactive: no role, no tabIndex on div */}
      <div onClick={onClick} className="cursor-pointer p-4">
        <span onClick={onClick} className="block">Submit order</span>
        <p style={{ color: '#1a1a1a', padding: '7px' }}>Click anywhere to continue</p>
      </div>

      {/* Positive tabIndex — disrupts natural tab order */}
      <input
        type="text"
        name="city"
        placeholder="City"
        tabIndex={2}
        style={{ border: '1px solid #cccccc', margin: '20px' }}
      />

      {/* animate-bounce */}
      <button className="animate-bounce">
        Get started
      </button>
    </section>
  );
}

// No prefers-reduced-motion guard
