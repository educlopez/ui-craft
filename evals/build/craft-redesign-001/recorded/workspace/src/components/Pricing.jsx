const tiers = ['Starter', 'Pro', 'Enterprise']

export default function Pricing() {
  return (
    <section className="section">
      <h2 className="section__title">Pricing</h2>
      <div className="pricing__grid">
        {tiers.map((tier) => (
          <div key={tier} className={tier === 'Pro' ? 'plan plan--featured' : 'plan'}>
            <h3 className="plan__name">{tier}</h3>
            <p className="plan__price">$29</p>
            <a href="/signup" className={tier === 'Pro' ? 'button button--primary' : 'button button--quiet'}>
              Choose {tier}
            </a>
          </div>
        ))}
      </div>
    </section>
  )
}
