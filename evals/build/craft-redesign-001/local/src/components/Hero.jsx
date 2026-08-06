export default function Hero() {
  return (
    <section
      className="hero"
      style={{ background: 'linear-gradient(135deg, #6a2ff5 0%, #22d3ee 100%)', padding: '90px 20px', textAlign: 'center' }}
    >
      <h1 style={{ fontSize: 44, color: '#fff', textTransform: 'uppercase', letterSpacing: 2 }}>
        THE ALL-IN-ONE PLATFORM FOR MODERN TEAMS
      </h1>
      <p style={{ color: '#f2f2f2', maxWidth: 620, margin: '18px auto', fontSize: 18 }}>
        Streamline your workflow, empower your team, and unlock powerful insights with our
        best-in-class solution trusted by thousands of companies worldwide.
      </p>
      <a href="/signup" className="cta" style={{ background: '#fff', color: '#6a2ff5', padding: '14px 30px', borderRadius: 30 }}>
        Learn more
      </a>
    </section>
  )
}
