// Slop fixture: maximum violations across all 3 dimensions
// Expected: score ≤ 45 (heavy penalties from every dimension)

export default function SlopShowcase({ onDelete }: { onDelete: () => void }) {
  return (
    <section
      className="bg-gradient-to-r from-purple-600 to-cyan-400"
      style={{ color: '#ff0000', borderRadius: '7px', padding: '20px' }}
    >
      {/* Anti-slop: uppercase heading, purple gradient */}
      <h1 className="text-4xl uppercase font-black">WELCOME TO OUR APP</h1>

      {/* A11y: img without alt */}
      <img src="/feature.png" width={400} height={300} />

      {/* A11y: div onClick without role or tabIndex */}
      <div onClick={onDelete} className="cursor-pointer">
        <span onClick={onDelete}>Delete account</span>
      </div>

      {/* A11y: positive tabIndex */}
      <input
        type="email"
        placeholder="Enter email"
        tabIndex={5}
        style={{ border: '1px solid #cccccc' }}
      />

      {/* Anti-slop: transition-all + animate-bounce */}
      <button className="animate-bounce transition-all duration-300">
        Learn more
      </button>

      {/* Anti-slop: bounce easing */}
      <div style={{ transition: 'all 0.4s ease', animation: 'bounce 1s infinite' }}>
        Bouncing content
      </div>
    </section>
  );
}

// No prefers-reduced-motion anywhere
