const icons = {
  fast: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  secure: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  insightful: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
}

const items = [
  { icon: icons.fast, title: 'Fast', text: 'Blazing fast performance that scales with your business needs.' },
  { icon: icons.secure, title: 'Secure', text: 'Enterprise-grade security to keep your data safe and sound.' },
  { icon: icons.insightful, title: 'Insightful', text: 'Powerful analytics that give you the insights you need.' },
]

export default function Features() {
  return (
    <section className="section section--tinted">
      <h2 className="section__title">Why choose us</h2>
      <div className="features__grid">
        {items.map((i) => (
          <div key={i.title} className="feature">
            <span className="feature__icon">{i.icon}</span>
            <h3 className="feature__title">{i.title}</h3>
            <p className="feature__text">{i.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
