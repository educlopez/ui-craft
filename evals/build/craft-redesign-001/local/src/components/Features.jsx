const items = [
  { icon: '🚀', title: 'Fast', text: 'Blazing fast performance that scales with your business needs.' },
  { icon: '🔒', title: 'Secure', text: 'Enterprise-grade security to keep your data safe and sound.' },
  { icon: '📊', title: 'Insightful', text: 'Powerful analytics that give you the insights you need.' },
]

export default function Features() {
  return (
    <section style={{ padding: '70px 20px', background: '#fafafa' }}>
      <h2 style={{ textAlign: 'center', textTransform: 'uppercase', fontSize: 30 }}>WHY CHOOSE US</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, maxWidth: 1040, margin: '40px auto' }}>
        {items.map((i) => (
          <div key={i.title} style={{ background: '#fff', borderRadius: 8, padding: 28, textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,.08)' }}>
            <div style={{ fontSize: 34 }}>{i.icon}</div>
            <h3 style={{ marginTop: 12 }}>{i.title}</h3>
            <p style={{ color: '#777' }}>{i.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
