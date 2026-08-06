import { useReveal } from '../hooks/useReveal.js'
import {
  LedgerVignette,
  NorthtrailVignette,
  PulseVignette,
  CalderaVignette,
} from './Vignettes.jsx'

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
    >
      <path
        d="M4.5 11.5 L11.5 4.5 M6 4.5 H11.5 V10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ProjectMeta({ project, featured = false }) {
  return (
    <div>
      <span
        aria-hidden="true"
        className={`block font-semibold tracking-tighter tabular-nums text-line-strong select-none ${
          featured ? 'text-[5.5rem] leading-none' : 'text-6xl leading-none'
        }`}
      >
        {project.index}
      </span>
      <h3 className={`mt-5 font-semibold tracking-tight ${featured ? 'text-3xl' : 'text-xl'}`}>
        {project.title}
        <span className="font-normal text-ink-tertiary"> · {project.kind}</span>
      </h3>
      <p className={`mt-2 leading-relaxed text-ink-secondary ${featured ? 'max-w-md text-lg' : 'text-[15px]'}`}>
        {project.summary}
      </p>
      <p className="mt-4 text-[15px] font-medium">{project.outcome}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent-strong">
        Read the case study
        <ArrowIcon />
      </span>
    </div>
  )
}

const projects = [
  {
    index: '01',
    title: 'Ledger',
    kind: 'Fintech platform',
    summary:
      'Rebuilt expense reconciliation around auto-matching, so finance teams review exceptions instead of every line.',
    outcome: 'Close time cut 62%, from 9 days to 3.4',
    vignette: <LedgerVignette />,
  },
  {
    index: '02',
    title: 'Northtrail',
    kind: 'Mobile app, 0→1',
    summary:
      'Designed a guided-hike booking app from concept to launch — search, itinerary, and offline trail support.',
    outcome: '4.8★ on the App Store, 120k downloads in year one',
    vignette: <NorthtrailVignette />,
  },
  {
    index: '03',
    title: 'Pulse',
    kind: 'Design system',
    summary:
      'Led the token architecture and component contracts now shared by five product teams.',
    outcome: '38 components, UI defect reports down 41%',
    vignette: <PulseVignette />,
  },
  {
    index: '04',
    title: 'Caldera',
    kind: 'Onboarding revamp',
    summary:
      'Replaced a 12-field signup wall with a progressive checklist that gets analysts to their first report fast.',
    outcome: 'Week-one activation up 19 points',
    vignette: <CalderaVignette />,
  },
]

function VignettePanel({ children, tall = false }) {
  return (
    <div
      className={`flex items-center justify-center rounded-2xl bg-surface p-8 transition-shadow duration-200 sm:p-10 ${
        tall ? 'min-h-[380px]' : 'min-h-[320px]'
      }`}
    >
      <div className="transition-transform duration-200 ease-out group-hover:scale-[1.015]">
        {children}
      </div>
    </div>
  )
}

function ProjectLink({ project, children, className = '' }) {
  return (
    <article className={className}>
      <a
        href={`#case-${project.title.toLowerCase()}`}
        aria-label={`${project.title} — read the case study`}
        className="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        {children}
      </a>
    </article>
  )
}

export default function Work() {
  const headerRef = useReveal()
  const gridRef = useReveal()
  const [featured, ...rest] = projects

  return (
    <section id="work" aria-labelledby="work-heading" className="border-t border-line pt-16 pb-28">
      <div ref={headerRef} className="reveal flex items-baseline justify-between">
        <h2 id="work-heading" className="text-2xl font-semibold tracking-tight">
          Selected work
        </h2>
        <p className="font-mono text-[13px] text-ink-tertiary tabular-nums">2019 – 2026</p>
      </div>

      <div ref={gridRef} className="reveal mt-12 grid grid-cols-1 gap-x-8 gap-y-16 md:grid-cols-12">
        {/* 01 — featured, full width, text + live vignette side by side */}
        <ProjectLink project={featured} className="md:col-span-12">
          <div className="grid grid-cols-1 items-center gap-8 rounded-2xl border border-line bg-white p-6 shadow-card transition-shadow duration-200 group-hover:shadow-card-hover sm:p-10 md:grid-cols-2">
            <ProjectMeta project={featured} featured />
            <VignettePanel tall>{featured.vignette}</VignettePanel>
          </div>
        </ProjectLink>

        {/* 02 / 03 — asymmetric pair, right column offset down */}
        <ProjectLink project={rest[0]} className="md:col-span-7">
          <VignettePanel>{rest[0].vignette}</VignettePanel>
          <div className="mt-6">
            <ProjectMeta project={rest[0]} />
          </div>
        </ProjectLink>

        <ProjectLink project={rest[1]} className="md:col-span-5 md:mt-20">
          <VignettePanel>{rest[1].vignette}</VignettePanel>
          <div className="mt-6">
            <ProjectMeta project={rest[1]} />
          </div>
        </ProjectLink>

        {/* 04 — offset wide row, meta leading */}
        <ProjectLink project={rest[2]} className="md:col-span-10 md:col-start-3">
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_1.2fr]">
            <ProjectMeta project={rest[2]} />
            <VignettePanel>{rest[2].vignette}</VignettePanel>
          </div>
        </ProjectLink>
      </div>
    </section>
  )
}
