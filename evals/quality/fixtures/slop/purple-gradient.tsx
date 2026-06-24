// Slop fixture: purple gradient + uppercase heading + transition-all + img-no-alt
// Expected: very low score (all 3 dimensions penalized)

export default function HeroSection() {
  return (
    <section className="bg-gradient-to-r from-purple-500 via-indigo-400 to-cyan-400">
      <h1 className="text-4xl font-bold uppercase">GET STARTED TODAY</h1>
      <img src="/hero-banner.png" width={800} height={400} />
      <div className="transition-all duration-300 hover:scale-105">
        <button>Learn more</button>
      </div>
    </section>
  );
}
