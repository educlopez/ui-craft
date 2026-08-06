import { useReveal } from '../hooks/useReveal.js'

const roles = [
  { company: 'Meridian', role: 'Senior Product Designer', years: '2023 – Now' },
  { company: 'Stripe', role: 'Product Designer', years: '2020 – 2023' },
  { company: 'Independent', role: 'Product Design Consultant', years: '2018 – 2020' },
]

export default function About() {
  const ref = useReveal()
  return (
    <section aria-labelledby="about-heading" className="border-t border-line pt-16 pb-28">
      <div ref={ref} className="reveal grid grid-cols-1 gap-10 md:grid-cols-12">
        <div className="md:col-span-5">
          <h2 id="about-heading" className="text-2xl font-semibold tracking-tight">
            About
          </h2>
          <p className="mt-5 leading-relaxed text-ink-secondary">
            I work end to end: research, flows, high-fidelity UI, and the
            production handoff. My favorite problems are the unglamorous ones —
            reconciliation queues, permission models, empty states — where
            good design shows up as time given back to the user.
          </p>
          <p className="mt-4 leading-relaxed text-ink-secondary">
            I prototype in code (React, mostly) and measure what ships. Every
            case study above ends with a number because that&rsquo;s how I
            judge my own work.
          </p>
        </div>
        <div className="md:col-span-6 md:col-start-7">
          <h3 className="font-mono text-[13px] tracking-wide text-ink-tertiary uppercase">
            Experience
          </h3>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {roles.map((item) => (
              <li key={item.company} className="flex items-baseline justify-between gap-4 py-4">
                <div>
                  <p className="font-medium">{item.company}</p>
                  <p className="text-sm text-ink-secondary">{item.role}</p>
                </div>
                <p className="font-mono text-[13px] text-ink-tertiary tabular-nums">{item.years}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
