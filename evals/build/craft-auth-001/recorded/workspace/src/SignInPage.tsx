import { useRef, useState, type SubmitEvent } from "react";

function MeridianMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect width="24" height="24" rx="6" className="fill-gray-9" />
      <path
        d="M6.5 16.5v-8l5.5 5 5.5-5v8"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.44a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.29a12 12 0 0 0 0 10.74l3.99-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.29 6.63l3.99 3.09C6.22 6.87 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {open ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M9.9 4.24A9.9 9.9 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.39-1.61" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <path d="m2 2 20 20" />
        </>
      )}
    </svg>
  );
}

/** Signature bet: one believable proof asset — metric + sparkline. */
function ProofAsset() {
  return (
    <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-card">
      <p className="text-[13px] text-gray-6">Payout volume, last 30 days</p>
      <p className="mt-1 text-[32px] font-semibold tracking-tight tabular-nums text-gray-9">
        $184.2M
      </p>
      <p className="mt-0.5 text-[13px] text-gray-6">+12.4% vs. prior period</p>
      <svg
        viewBox="0 0 288 56"
        className="mt-5 w-full"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 44 L24 40 L48 42 L72 34 L96 37 L120 28 L144 31 L168 22 L192 25 L216 16 L240 19 L264 10 L288 6 V56 H0 Z"
          fill="url(#spark-fill)"
        />
        <path
          d="M0 44 L24 40 L48 42 L72 34 L96 37 L120 28 L144 31 L168 22 L192 25 L216 16 L240 19 L264 10 L288 6"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-input border border-gray-2 bg-white px-3 text-[14px] text-gray-9 " +
  "placeholder:text-gray-3 transition-[border-color,box-shadow] duration-150 " +
  "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-tint " +
  "aria-[invalid=true]:border-danger";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) {
      next.email = "Enter your email.";
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      next.email = "That doesn’t look like an email address.";
    }
    if (!password) {
      next.password = "Enter your password.";
    }
    setErrors(next);
    if (next.email) {
      emailRef.current?.focus();
      return;
    }
    if (next.password) {
      passwordRef.current?.focus();
      return;
    }
    // Hand off to the auth backend here.
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Proof panel — tinted neutral, one proof asset, trust foot */}
      <aside className="hidden flex-col justify-between border-r border-gray-2 bg-gray-1 p-10 lg:flex">
        <a href="/" className="flex w-fit items-center gap-2.5 rounded-input focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          <MeridianMark className="size-7" />
          <span className="text-[15px] font-semibold tracking-tight text-gray-9">
            Meridian
          </span>
        </a>

        <div className="flex flex-col items-start gap-6">
          <ProofAsset />
          <p className="max-w-sm text-[13px] leading-relaxed text-gray-6">
            Finance teams at 1,400 companies run payouts, treasury, and
            reconciliation on Meridian.
          </p>
        </div>

        <p className="max-w-md text-xs leading-relaxed text-gray-6">
          Meridian is a financial technology company, not a bank. Banking
          services are provided by our partner banks, Members FDIC. SOC 2
          Type II certified.
        </p>
      </aside>

      {/* Form column */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          <a href="/" className="mb-8 flex w-fit items-center gap-2.5 rounded-input focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent lg:hidden">
            <MeridianMark className="size-7" />
            <span className="text-[15px] font-semibold tracking-tight text-gray-9">
              Meridian
            </span>
          </a>

          <h1 className="text-2xl font-semibold tracking-tight text-gray-9">
            Welcome back
          </h1>
          <p className="mt-1.5 text-[14px] text-gray-6">
            Pick up where you left off with your accounts.
          </p>

          <button
            type="button"
            className="mt-8 flex h-11 w-full items-center justify-center gap-2.5 rounded-input border border-gray-2 bg-white text-[14px] font-medium text-gray-9 shadow-card transition-colors duration-150 hover:bg-gray-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]"
          >
            <GoogleMark />
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-gray-2" />
            <span className="text-[13px] text-gray-6">or with email</span>
            <span className="h-px flex-1 bg-gray-2" />
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-[13px] font-medium text-gray-7"
              >
                Email
              </label>
              <input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={inputClass}
              />
              {errors.email && (
                <p id="email-error" className="mt-1.5 text-[13px] text-danger">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="mt-5">
              <div className="mb-1.5 flex items-baseline justify-between">
                <label
                  htmlFor="password"
                  className="text-[13px] font-medium text-gray-7"
                >
                  Password
                </label>
                <a
                  href="/forgot-password"
                  className="rounded-input text-[13px] font-medium text-accent transition-colors duration-150 hover:text-accent-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-input text-gray-6 transition-colors duration-150 hover:text-gray-9 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {errors.password && (
                <p
                  id="password-error"
                  className="mt-1.5 text-[13px] text-danger"
                >
                  {errors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="mt-7 h-11 w-full rounded-input bg-accent text-[14px] font-medium text-on-accent transition-[background-color,transform] duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.99]"
            >
              Sign in
            </button>
          </form>

          <p className="mt-6 text-center text-[14px] text-gray-6">
            New to Meridian?{" "}
            <a
              href="/signup"
              className="rounded-input font-medium text-accent transition-colors duration-150 hover:text-accent-hover hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Open an account
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
