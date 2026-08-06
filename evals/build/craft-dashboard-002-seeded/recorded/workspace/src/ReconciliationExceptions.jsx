import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import "./tokens.css";

/* ---------- Icons (inline SVG, Lucide-style, 16px stroke) ---------- */

const Icon = ({ d, size = 16, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {d}
  </svg>
);

const SearchIcon = (p) => (
  <Icon {...p} d={<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>} />
);
const CheckIcon = (p) => <Icon {...p} d={<path d="M20 6 9 17l-5-5" />} />;
const ScaleIcon = (p) => (
  <Icon {...p} d={<><path d="M12 3v18" /><path d="M4 7h16" /><path d="m6 7-2 5a3 3 0 0 0 4 0l-2-5Z" /><path d="m18 7-2 5a3 3 0 0 0 4 0l-2-5Z" /></>} />
);
const InboxIcon = (p) => (
  <Icon {...p} d={<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1Z" /></>} />
);
const AlertIcon = (p) => (
  <Icon {...p} d={<><circle cx="12" cy="12" r="9" /><path d="M12 8v4" /><path d="M12 16h.01" /></>} />
);

/* ---------- Formatting ---------- */

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});
const fmtAmount = (n) => (n < 0 ? `(${usd.format(-n)})` : usd.format(n));

/* ---------- Mock data: overnight run, 6 Aug 2026 ---------- */

const RUN = {
  label: "Overnight run · 6 Aug 2026, 02:14 ET",
  processed: 1284,
  autoMatched: 1237,
};

const REASONS = [
  "No ledger match",
  "Amount mismatch",
  "Duplicate candidate",
  "Date outside window",
];

const INITIAL_ROWS = [
  {
    id: "exc-9041",
    ref: "BNK-20260806-0147",
    counterparty: "Stripe payout",
    posted: "6 Aug, 01:52",
    source: "Bank feed",
    amount: 48210.55,
    reason: "Amount mismatch",
    discrepancy: -420.0,
    age: "9h",
    status: "open",
    bank: { ref: "BNK-20260806-0147", date: "6 Aug 2026", amount: 48210.55, memo: "STRIPE PAYOUT AUG-05" },
    ledger: { ref: "JE-118204", date: "5 Aug 2026", amount: 48630.55, memo: "Stripe payout, net of fees", confidence: 91 },
  },
  {
    id: "exc-9042",
    ref: "BNK-20260806-0212",
    counterparty: "AWS EMEA SARL",
    posted: "6 Aug, 02:03",
    source: "Bank feed",
    amount: -12480.0,
    reason: "No ledger match",
    discrepancy: null,
    age: "9h",
    status: "open",
    bank: { ref: "BNK-20260806-0212", date: "6 Aug 2026", amount: -12480.0, memo: "AWS EMEA SARL INV-88412" },
    ledger: null,
  },
  {
    id: "exc-9043",
    ref: "JE-118377",
    counterparty: "Gusto payroll",
    posted: "5 Aug, 23:40",
    source: "Ledger",
    amount: -84102.18,
    reason: "Date outside window",
    discrepancy: null,
    age: "11h",
    status: "open",
    bank: { ref: "BNK-20260803-0091", date: "3 Aug 2026", amount: -84102.18, memo: "GUSTO PAY 802411" },
    ledger: { ref: "JE-118377", date: "5 Aug 2026", amount: -84102.18, memo: "Payroll period ending 31 Jul", confidence: 84 },
  },
  {
    id: "exc-9044",
    ref: "BNK-20260806-0230",
    counterparty: "Snowflake Inc.",
    posted: "6 Aug, 02:07",
    source: "Bank feed",
    amount: -9862.4,
    reason: "Duplicate candidate",
    discrepancy: null,
    age: "9h",
    status: "open",
    bank: { ref: "BNK-20260806-0230", date: "6 Aug 2026", amount: -9862.4, memo: "SNOWFLAKE INV-2260794" },
    ledger: { ref: "JE-118216", date: "4 Aug 2026", amount: -9862.4, memo: "Snowflake usage, July — already matched to BNK-20260804-0187", confidence: 62 },
  },
  {
    id: "exc-9045",
    ref: "BNK-20260806-0244",
    counterparty: "Adyen settlement",
    posted: "6 Aug, 02:09",
    source: "Bank feed",
    amount: 132904.07,
    reason: "Amount mismatch",
    discrepancy: 96.13,
    age: "9h",
    status: "open",
    bank: { ref: "BNK-20260806-0244", date: "6 Aug 2026", amount: 132904.07, memo: "ADYEN BV SETTLE 2026-08-05" },
    ledger: { ref: "JE-118391", date: "5 Aug 2026", amount: 132807.94, memo: "Adyen settlement batch 4471", confidence: 95 },
  },
  {
    id: "exc-9046",
    ref: "JE-118298",
    counterparty: "WeWork commons",
    posted: "4 Aug, 16:12",
    source: "Ledger",
    amount: -6200.0,
    reason: "No ledger match",
    discrepancy: null,
    age: "1d 19h",
    status: "open",
    bank: null,
    ledger: { ref: "JE-118298", date: "4 Aug 2026", amount: -6200.0, memo: "Office rent, August", confidence: null },
  },
  {
    id: "exc-9047",
    ref: "BNK-20260806-0251",
    counterparty: "Wire — Meridian Ltd (UK)",
    posted: "6 Aug, 02:11",
    source: "Bank feed",
    amount: 25000.0,
    reason: "No ledger match",
    discrepancy: null,
    age: "9h",
    status: "open",
    bank: { ref: "BNK-20260806-0251", date: "6 Aug 2026", amount: 25000.0, memo: "INTERCO FUNDING GB29 MERI" },
    ledger: null,
  },
  {
    id: "exc-9048",
    ref: "BNK-20260805-0198",
    counterparty: "Salesforce Inc.",
    posted: "5 Aug, 02:20",
    source: "Bank feed",
    amount: -41300.0,
    reason: "Amount mismatch",
    discrepancy: -1300.0,
    age: "1d 9h",
    status: "open",
    bank: { ref: "BNK-20260805-0198", date: "5 Aug 2026", amount: -41300.0, memo: "SALESFORCE INV-7719340" },
    ledger: { ref: "JE-118102", date: "4 Aug 2026", amount: -40000.0, memo: "Salesforce annual true-up", confidence: 88 },
  },
  {
    id: "exc-9049",
    ref: "BNK-20260803-0042",
    counterparty: "Check deposit #4471",
    posted: "3 Aug, 11:05",
    source: "Bank feed",
    amount: 3150.0,
    reason: "Date outside window",
    discrepancy: null,
    age: "3d",
    status: "open",
    bank: { ref: "BNK-20260803-0042", date: "3 Aug 2026", amount: 3150.0, memo: "REMOTE DEPOSIT 4471" },
    ledger: { ref: "JE-117960", date: "28 Jul 2026", amount: 3150.0, memo: "Customer check — Halstead Group", confidence: 79 },
  },
  {
    id: "exc-9050",
    ref: "BNK-20260806-0102",
    counterparty: "Interest — operating acct",
    posted: "6 Aug, 00:31",
    source: "Bank feed",
    amount: 412.88,
    reason: "No ledger match",
    discrepancy: null,
    age: "11h",
    status: "cleared",
    clearedNote: "Cleared 06:12 by M. Okafor — monthly interest, booked JE-118402",
    bank: { ref: "BNK-20260806-0102", date: "6 Aug 2026", amount: 412.88, memo: "INTEREST CREDIT" },
    ledger: null,
  },
];

const SPARK_OPEN = [4, 6, 3, 9, 7, 12, 8, 14, 11, 9]; // exceptions/day, last 10 runs

/* ---------- Small pieces ---------- */

function Sparkline({ points, width = 96, height = 32 }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const step = width / (points.length - 1);
  const y = (v) => height - 3 - ((v - min) / (max - min)) * (height - 6);
  const line = points.map((v, i) => `${i * step},${y(v).toFixed(1)}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;
  return (
    <svg width={width} height={height} aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#spark-fill)" />
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
    </svg>
  );
}

function StatusDot({ reason, cleared }) {
  // Teal is the only chromatic colour in Meridian. Open-exception categories
  // are told apart by dot weight on the neutral ramp; teal marks cleared only.
  if (cleared) {
    return <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />;
  }
  const tone = {
    "No ledger match": "bg-[var(--gray-9)]",
    "Amount mismatch": "bg-[var(--gray-9)] ring-2 ring-[var(--gray-2)]",
    "Duplicate candidate": "bg-[var(--gray-6)]",
    "Date outside window": "border border-[var(--gray-6)] bg-transparent",
  }[reason];
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${tone}`} />;
}

function Kbd({ children }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-[var(--line)] bg-[var(--surface)] px-1 font-sans text-[11px] text-[var(--text-muted)]">
      {children}
    </kbd>
  );
}

/* ---------- Shell: sidebar ---------- */

const NAV = [
  { label: "Overview" },
  { label: "Exceptions", active: true, count: null },
  { label: "Matches" },
  { label: "Rules" },
  { label: "Accounts" },
  { label: "Reports" },
];

function Sidebar({ openCount }) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)]">
      <div className="flex h-14 items-center gap-2 px-4">
        <ScaleIcon size={18} className="text-[var(--text)]" />
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)]">
          Meridian
        </span>
      </div>
      <nav aria-label="Main navigation" className="flex-1 px-2 pt-2">
        <ul className="space-y-0.5">
          {NAV.map((item) => (
            <li key={item.label}>
              <a
                href="#"
                aria-current={item.active ? "page" : undefined}
                className={`flex h-8 items-center justify-between rounded-[6px] px-2.5 text-[13px] outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  item.active
                    ? "bg-[var(--accent-tint)] font-medium text-[var(--accent)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--gray-2)] hover:text-[var(--text)]"
                }`}
              >
                {item.label}
                {item.active && openCount > 0 && (
                  <span className="text-[12px] tabular-nums">{openCount}</span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-[var(--line)] px-4 py-3">
        <p className="text-[13px] font-medium text-[var(--text)]">M. Okafor</p>
        <p className="text-[12px] text-[var(--text-muted)]">Finance ops</p>
      </div>
    </aside>
  );
}

/* ---------- Metric strip ---------- */

function MetricStrip({ openCount, unmatchedValue, oldestAge }) {
  const rate = ((RUN.autoMatched / RUN.processed) * 100).toFixed(1);
  return (
    <div className="grid grid-cols-4 gap-4">
      {/* Hero: the number the analyst is here to drive to zero */}
      <div className="rounded-[10px] border border-[var(--accent)]/20 bg-[var(--accent-tint)] p-4">
        <p className="text-[12px] font-medium text-[var(--text-muted)]">Open exceptions</p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <span className="text-4xl font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--accent)]">
            {openCount}
          </span>
          <Sparkline points={SPARK_OPEN} />
        </div>
        <p className="mt-2 text-[12px] tabular-nums text-[var(--text-muted)]">
          47 raised by this run · 9 fewer than yesterday
        </p>
      </div>
      {[
        {
          label: "Unmatched value",
          value: fmtAmount(unmatchedValue),
          note: "Absolute sum of open items",
        },
        {
          label: "Auto-match rate",
          value: `${rate}%`,
          note: `${RUN.autoMatched.toLocaleString("en-US")} of ${RUN.processed.toLocaleString("en-US")} transactions`,
        },
        {
          label: "Oldest open",
          value: oldestAge,
          note: "Check deposit #4471 · 3 Aug",
        },
      ].map((m) => (
        <div key={m.label} className="rounded-[10px] border border-[var(--line)] bg-[var(--bg)] p-4 shadow-[var(--shadow-card)]">
          <p className="text-[12px] font-medium text-[var(--text-muted)]">{m.label}</p>
          <p className="mt-1 text-[28px] font-bold leading-none tracking-[-0.02em] tabular-nums text-[var(--text)]">
            {m.value}
          </p>
          <p className="mt-2 truncate text-[12px] tabular-nums text-[var(--text-muted)]">{m.note}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- Expanded row: bank vs ledger comparison ---------- */

function ComparisonPanel({ row, onMatch, onClear }) {
  const sides = [
    { title: "Bank feed", rec: row.bank, emptyNote: "No bank record — ledger entry has no counterpart in the feed." },
    { title: "Ledger candidate", rec: row.ledger, emptyNote: "No ledger candidate above 60% confidence." },
  ];
  const amountsDiffer = row.bank && row.ledger && row.bank.amount !== row.ledger.amount;
  return (
    <div className="border-t border-[var(--line)] bg-[var(--surface)] px-12 py-4">
      <div className="grid grid-cols-2 gap-4">
        {sides.map(({ title, rec, emptyNote }) => (
          <div key={title} className="rounded-[6px] border border-[var(--line)] bg-[var(--bg)] p-3">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {title}
              </p>
              {rec?.confidence != null && (
                <p className="text-[12px] tabular-nums text-[var(--text-muted)]">
                  {rec.confidence}% confidence
                </p>
              )}
            </div>
            {rec ? (
              <dl className="mt-2 space-y-1 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Reference</dt>
                  <dd className="font-medium text-[var(--text)]">{rec.ref}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Date</dt>
                  <dd className="tabular-nums text-[var(--text)]">{rec.date}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Amount</dt>
                  <dd className={`tabular-nums ${amountsDiffer ? "font-semibold underline decoration-[var(--gray-3)] decoration-2 underline-offset-4" : ""} text-[var(--text)]`}>
                    {fmtAmount(rec.amount)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-[var(--text-muted)]">Memo</dt>
                  <dd className="truncate text-right text-[var(--text)]" title={rec.memo}>{rec.memo}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-[13px] text-[var(--text-muted)]">{emptyNote}</p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        {row.ledger && row.bank && (
          <button
            onClick={() => onMatch(row.id)}
            className="h-8 rounded-[6px] bg-[var(--accent)] px-3 text-[13px] font-medium text-white outline-none transition-transform duration-150 motion-reduce:transition-none hover:opacity-90 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            Accept match
          </button>
        )}
        <button
          onClick={() => onClear([row.id])}
          className="h-8 rounded-[6px] border border-[var(--line)] bg-[var(--bg)] px-3 text-[13px] font-medium text-[var(--text)] outline-none transition-colors duration-150 motion-reduce:transition-none hover:bg-[var(--gray-2)] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        >
          Clear as reviewed
        </button>
        {amountsDiffer && (
          <p className="ml-2 text-[12px] tabular-nums text-[var(--text-muted)]">
            Amounts differ by {fmtAmount(Math.abs(row.bank.amount - row.ledger.amount))}. Accepting posts an adjustment entry.
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- Screen ---------- */

export default function ReconciliationExceptions() {
  const [phase, setPhase] = useState("loading"); // loading | error | ready
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [tab, setTab] = useState("open"); // open | cleared | all
  const [reasonFilters, setReasonFilters] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [toast, setToast] = useState(null); // { message, undoIds }
  const headerCheckRef = useRef(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setPhase("ready"), 450);
    return () => clearTimeout(t);
  }, []);

  const openRows = rows.filter((r) => r.status === "open");
  const filtered = useMemo(() => {
    let out = rows;
    if (tab !== "all") out = out.filter((r) => r.status === (tab === "open" ? "open" : "cleared"));
    if (reasonFilters.length) out = out.filter((r) => reasonFilters.includes(r.reason));
    return out;
  }, [rows, tab, reasonFilters]);

  const unmatchedValue = openRows.reduce((s, r) => s + Math.abs(r.amount), 0);

  useEffect(() => {
    if (headerCheckRef.current) {
      const openFiltered = filtered.filter((r) => r.status === "open");
      headerCheckRef.current.indeterminate =
        selected.size > 0 && selected.size < openFiltered.length;
    }
  }, [selected, filtered]);

  useEffect(() => {
    setActiveIdx((i) => Math.min(i, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  const showToast = (message, undoIds) => {
    clearTimeout(toastTimer.current);
    setToast({ message, undoIds });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };

  const clearRows = (ids) => {
    setRows((rs) =>
      rs.map((r) =>
        ids.includes(r.id)
          ? { ...r, status: "cleared", clearedNote: "Cleared just now by M. Okafor" }
          : r
      )
    );
    setSelected(new Set());
    setExpandedId(null);
    showToast(
      `${ids.length} exception${ids.length === 1 ? "" : "s"} cleared.`,
      ids
    );
  };

  const acceptMatch = (id) => {
    clearRows([id]);
  };

  const undoClear = () => {
    if (!toast) return;
    setRows((rs) =>
      rs.map((r) =>
        toast.undoIds.includes(r.id) ? { ...r, status: "open", clearedNote: undefined } : r
      )
    );
    setToast(null);
  };

  /* Keyboard: j/k or arrows navigate, enter inspects, c clears active row */
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (phase !== "ready" || filtered.length === 0) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const row = filtered[activeIdx];
        if (row) setExpandedId((id) => (id === row.id ? null : row.id));
      } else if (e.key === "c") {
        const row = filtered[activeIdx];
        if (row && row.status === "open") clearRows([row.id]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, filtered, activeIdx]);

  const toggleReason = (r) =>
    setReasonFilters((fs) => (fs.includes(r) ? fs.filter((x) => x !== r) : [...fs, r]));

  const openFiltered = filtered.filter((r) => r.status === "open");
  const allSelected = openFiltered.length > 0 && openFiltered.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(openFiltered.map((r) => r.id)));
  const toggleOne = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filtersActive = reasonFilters.length > 0;
  const clearedToday = rows.filter((r) => r.status === "cleared").length;

  return (
    <div className="flex h-screen bg-[var(--bg)] font-sans text-[var(--text)] antialiased">
      <Sidebar openCount={openRows.length} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--line)] px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-[15px] font-semibold tracking-[-0.01em]">
              Reconciliation exceptions
            </h1>
            <p className="text-[13px] tabular-nums text-[var(--text-muted)]">{RUN.label}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex h-8 items-center gap-2 rounded-[6px] border border-[var(--line)] px-2.5 text-[13px] text-[var(--text-muted)] outline-none transition-colors duration-150 motion-reduce:transition-none hover:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
              <SearchIcon size={14} />
              Search transactions
              <Kbd>⌘K</Kbd>
            </button>
            <button className="h-8 rounded-[6px] border border-[var(--line)] px-2.5 text-[13px] text-[var(--text)] outline-none transition-colors duration-150 motion-reduce:transition-none hover:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
              Export
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {phase === "loading" && <LoadingSkeleton />}

          {phase === "error" && (
            <div className="flex flex-col items-center rounded-[10px] border border-[var(--line)] py-20 text-center">
              <AlertIcon size={20} className="text-[var(--text-muted)]" />
              <p className="mt-3 text-[14px] font-medium">The overnight run could not be loaded.</p>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                The matching service did not respond. Exceptions from the 5 Aug run are unaffected.
              </p>
              <button
                onClick={() => setPhase("ready")}
                className="mt-4 h-8 rounded-[6px] border border-[var(--line)] px-3 text-[13px] font-medium hover:bg-[var(--surface)]"
              >
                Retry
              </button>
            </div>
          )}

          {phase === "ready" && (
            <>
              <MetricStrip
                openCount={openRows.length}
                unmatchedValue={unmatchedValue}
                oldestAge="3d 0h"
              />

              {/* Filter row */}
              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-1" role="tablist" aria-label="Exception status">
                  {[
                    { key: "open", label: `Open (${openRows.length})` },
                    { key: "cleared", label: `Cleared today (${clearedToday})` },
                    { key: "all", label: "All" },
                  ].map((t) => (
                    <button
                      key={t.key}
                      role="tab"
                      aria-selected={tab === t.key}
                      onClick={() => { setTab(t.key); setSelected(new Set()); }}
                      className={`h-8 rounded-[6px] px-2.5 text-[13px] tabular-nums outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                        tab === t.key
                          ? "bg-[var(--accent-tint)] font-medium text-[var(--accent)]"
                          : "text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      aria-pressed={reasonFilters.includes(r)}
                      onClick={() => toggleReason(r)}
                      className={`h-8 rounded-[6px] border px-2.5 text-[13px] outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                        reasonFilters.includes(r)
                          ? "border-[var(--accent)]/30 bg-[var(--accent-tint)] font-medium text-[var(--accent)]"
                          : "border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                  {filtersActive && (
                    <button
                      onClick={() => setReasonFilters([])}
                      className="ml-1 text-[13px] text-[var(--text-muted)] underline underline-offset-2 outline-none hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Bulk action bar */}
              {selected.size > 0 && (
                <div className="mt-3 flex h-11 items-center justify-between rounded-[6px] border border-[var(--accent)]/25 bg-[var(--accent-tint)] px-3">
                  <p className="text-[13px] font-medium tabular-nums text-[var(--text)]">
                    {selected.size} selected
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => clearRows([...selected])}
                      className="h-7 rounded-[6px] bg-[var(--accent)] px-2.5 text-[13px] font-medium text-white outline-none transition-transform duration-150 motion-reduce:transition-none hover:opacity-90 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                    >
                      Clear as reviewed
                    </button>
                    <button
                      onClick={() => setSelected(new Set())}
                      className="h-7 rounded-[6px] px-2 text-[13px] text-[var(--text-muted)] outline-none hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Work queue */}
              <div className="mt-3 overflow-hidden rounded-[10px] border border-[var(--line)] shadow-[var(--shadow-card)]">
                {filtered.length === 0 ? (
                  <EmptyState
                    filtersActive={filtersActive}
                    tab={tab}
                    onReset={() => setReasonFilters([])}
                  />
                ) : (
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--line)] bg-[var(--surface)] text-left">
                        <th className="w-10 px-3 py-2.5">
                          <input
                            ref={headerCheckRef}
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleAll}
                            disabled={openFiltered.length === 0}
                            aria-label="Select all open exceptions"
                            className="block h-3.5 w-3.5 accent-[var(--accent)]"
                          />
                        </th>
                        {["Transaction", "Posted", "Source", "Reason"].map((h) => (
                          <th key={h} className="px-3 py-2.5 font-medium text-[var(--text-muted)]">{h}</th>
                        ))}
                        <th className="px-3 py-2.5 text-right font-medium text-[var(--text-muted)]">Amount</th>
                        <th className="px-3 py-2.5 text-right font-medium text-[var(--text-muted)]">Difference</th>
                        <th className="px-3 py-2.5 text-right font-medium text-[var(--text-muted)]">Age</th>
                        <th className="w-40 px-3 py-2.5" aria-label="Row actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row, idx) => {
                        const isCleared = row.status === "cleared";
                        const isActive = idx === activeIdx;
                        const isExpanded = expandedId === row.id;
                        return (
                          <Fragment key={row.id}>
                            <tr
                              onClick={() => {
                                setActiveIdx(idx);
                                setExpandedId(isExpanded ? null : row.id);
                              }}
                              aria-expanded={isExpanded}
                              className={`group cursor-pointer border-b border-[var(--line)] transition-colors duration-150 last:border-b-0 motion-reduce:transition-none ${
                                isActive ? "bg-[var(--surface)]" : "hover:bg-[var(--surface)]"
                              } ${isCleared ? "text-[var(--text-muted)]" : ""}`}
                            >
                              <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                {!isCleared && (
                                  <input
                                    type="checkbox"
                                    checked={selected.has(row.id)}
                                    onChange={() => toggleOne(row.id)}
                                    aria-label={`Select ${row.ref}`}
                                    className="block h-3.5 w-3.5 accent-[var(--accent)]"
                                  />
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                <p className={`font-medium ${isCleared ? "" : "text-[var(--text)]"}`}>
                                  {row.counterparty}
                                </p>
                                <p className="text-[12px] tabular-nums text-[var(--text-muted)]">{row.ref}</p>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[var(--text-muted)]">
                                {row.posted}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-[var(--text-muted)]">
                                {row.source}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5">
                                <span className="flex items-center gap-2">
                                  <StatusDot reason={row.reason} cleared={isCleared} />
                                  {isCleared ? "Cleared" : row.reason}
                                </span>
                              </td>
                              <td className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${isCleared ? "" : "text-[var(--text)]"}`}>
                                {fmtAmount(row.amount)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-[var(--text-muted)]">
                                {row.discrepancy != null ? fmtAmount(row.discrepancy) : "—"}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-[var(--text-muted)]">
                                {row.age}
                              </td>
                              <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                                {!isCleared && (
                                  <span className="invisible flex justify-end gap-1 group-hover:visible">
                                    <button
                                      onClick={() => {
                                        setActiveIdx(idx);
                                        setExpandedId(isExpanded ? null : row.id);
                                      }}
                                      className="h-7 rounded-[6px] border border-[var(--line)] bg-[var(--bg)] px-2 text-[12px] font-medium text-[var(--text)] outline-none hover:bg-[var(--gray-2)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                    >
                                      Inspect
                                    </button>
                                    <button
                                      onClick={() => clearRows([row.id])}
                                      className="h-7 rounded-[6px] border border-[var(--line)] bg-[var(--bg)] px-2 text-[12px] font-medium text-[var(--text)] outline-none hover:bg-[var(--gray-2)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                    >
                                      Clear
                                    </button>
                                  </span>
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr>
                                <td colSpan={9} className="p-0">
                                  {isCleared ? (
                                    <div className="border-t border-[var(--line)] bg-[var(--surface)] px-12 py-3">
                                      <p className="flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
                                        <CheckIcon size={14} className="text-[var(--accent)]" />
                                        {row.clearedNote}
                                      </p>
                                    </div>
                                  ) : (
                                    <ComparisonPanel row={row} onMatch={acceptMatch} onClear={clearRows} />
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {/* Keyboard hint rail — the queue is meant to be worked without a mouse */}
                {filtered.length > 0 && (
                  <div className="flex items-center gap-4 border-t border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
                    <span className="flex items-center gap-1.5"><Kbd>j</Kbd><Kbd>k</Kbd> navigate</span>
                    <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> inspect</span>
                    <span className="flex items-center gap-1.5"><Kbd>c</Kbd> clear as reviewed</span>
                    <span className="ml-auto tabular-nums">
                      {filtered.length} of {rows.length} exceptions
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Undo toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] py-2 pl-4 pr-2 text-[13px] shadow-[0_4px_12px_rgb(28_32_36/0.12)]"
        >
          <span className="tabular-nums">{toast.message}</span>
          <button
            onClick={undoClear}
            className="h-7 rounded-[6px] px-2 font-medium text-[var(--accent)] outline-none hover:bg-[var(--accent-tint)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- States ---------- */

function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading exceptions">
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[118px] animate-pulse rounded-[10px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
        ))}
      </div>
      <div className="mt-6 h-8 w-96 animate-pulse rounded-[6px] bg-[var(--surface)] motion-reduce:animate-none" />
      <div className="mt-3 overflow-hidden rounded-[10px] border border-[var(--line)]">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[var(--line)] px-3 py-3 last:border-b-0">
            <div className="h-3.5 w-3.5 animate-pulse rounded bg-[var(--gray-2)] motion-reduce:animate-none" />
            <div className="h-4 w-48 animate-pulse rounded bg-[var(--gray-2)] motion-reduce:animate-none" />
            <div className="h-4 w-24 animate-pulse rounded bg-[var(--gray-2)] motion-reduce:animate-none" />
            <div className="ml-auto h-4 w-28 animate-pulse rounded bg-[var(--gray-2)] motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ filtersActive, tab, onReset }) {
  if (filtersActive) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <p className="text-[14px] font-medium">No exceptions match these filters.</p>
        <button
          onClick={onReset}
          className="mt-2 text-[13px] text-[var(--accent)] underline underline-offset-2 outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Reset filters
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <InboxIcon size={22} className="text-[var(--text-muted)]" />
      <p className="mt-3 text-[14px] font-medium">
        {tab === "cleared" ? "Nothing cleared yet today." : "Queue is clear."}
      </p>
      <p className="mt-1 max-w-sm text-[13px] text-[var(--text-muted)]">
        {tab === "cleared"
          ? "Exceptions you clear will appear here with who cleared them and when."
          : "Every transaction from the overnight run has been matched or cleared. The next run starts at 02:00 ET."}
      </p>
    </div>
  );
}
