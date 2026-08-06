# Design brief — Meridian

## 1. Product identity
Meridian is a reconciliation console for finance operations teams at mid-market SaaS companies.
Users live in it for four hours a day. It is not a product they enjoy; it is one they trust.

## 2. Design intent
Sober, dense, unmistakably a tool. Nothing celebratory. The interface should feel like it was
built by someone who has done the job.

## 3. Audience
Finance ops analysts. High domain expertise, low tolerance for decoration. They keep six
browser tabs open and compare numbers between them.

## 4. Voice
Plain and precise. Never "Oops!" or "Awesome!". An error says what failed and what to do.

## 5. Constraints
- Brand accent is `--accent-600` (teal). It is the only chromatic colour in the product.
- Dark mode is not supported and will not be.
- Numbers are always `tabular-nums`. Always.

## 6. Learned constraints
- **2026-05-12** — Never use a coloured pill for a delta. The team reads red/green as
  reconciliation status, not as direction, and coloured deltas caused a real misread.
- **2026-06-30** — Sidebar stays light. A dark rail was tried and rejected: it read as a
  different application to users switching between Meridian and their ERP.
