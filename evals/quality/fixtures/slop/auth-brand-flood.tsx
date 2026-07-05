// Slop fixture: the recognizable AI auth screen — saturated full-bleed brand panel,
// caps "OR" divider, ALL CAPS heading, placeholder-as-label, no autocomplete, transition-all
// Expected: low score (brand-flood + or-divider + uppercase + forms violations)

export default function SignIn() {
  return (
    <div className="flex">
      <aside className="min-h-screen w-1/2 bg-indigo-600" aria-hidden="true" />
      <main className="flex min-h-screen w-1/2 items-center justify-center">
        <form className="w-96">
          <h1 className="text-2xl font-bold uppercase">Welcome back</h1>
          <input
            type="email"
            placeholder="Email"
            className="mt-6 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
          <div className="my-4 text-center text-xs text-neutral-500">OR</div>
          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
          <button
            type="submit"
            className="mt-6 w-full rounded-md bg-indigo-600 px-4 py-2 text-white transition-all duration-300 hover:scale-105"
          >
            Sign in
          </button>
        </form>
      </main>
    </div>
  );
}
