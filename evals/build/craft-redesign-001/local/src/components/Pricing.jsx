export default function Pricing() {
  return (
    <section style={{ padding: '70px 20px' }}>
      <h2 style={{ textAlign: 'center', textTransform: 'uppercase', fontSize: 30 }}>PRICING</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, maxWidth: 960, margin: '36px auto' }}>
        {['Starter', 'Pro', 'Enterprise'].map((tier) => (
          <div key={tier} style={{ border: '3px solid #6a2ff5', borderRadius: 10, padding: 26, textAlign: 'center' }}>
            <h3>{tier}</h3>
            <p style={{ fontSize: 32, background: 'linear-gradient(90deg,#6a2ff5,#22d3ee)', WebkitBackgroundClip: 'text', color: 'transparent' }}>$29</p>
            <a href="/signup" style={{ display: 'inline-block', marginTop: 14 }}>Get started</a>
          </div>
        ))}
      </div>
    </section>
  )
}
