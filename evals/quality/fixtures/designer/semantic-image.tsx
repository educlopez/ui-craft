// Designer fixture: proper image usage with alt text and motion-safe animation
// Expected: high score (≥ 80)

interface HeroProps {
  imageSrc: string;
  imageAlt: string;
  heading: string;
}

export default function SemanticHero({ imageSrc, imageAlt, heading }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-neutral-50">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          {heading}
        </h1>
        <p className="mt-4 text-base text-neutral-600">
          Build better interfaces with systematic design principles.
        </p>
        <div className="mt-8">
          <button
            type="button"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            Explore the design system
          </button>
        </div>
      </div>
      <div className="mt-8">
        <img
          src={imageSrc}
          alt={imageAlt}
          width={800}
          height={450}
          className="rounded-xl shadow-md"
        />
      </div>
    </section>
  );
}
