// Mock work-queue data for the Flowline ops console.
// "age" is time since the item last needed attention; "sla" flags items
// past their response/resolution window — the thing an operator scans for.

export const navItems = [
  { key: "queue", label: "Work queue", icon: "ListChecks" },
  { key: "customers", label: "Customers", icon: "Building2" },
  { key: "automations", label: "Automations", icon: "Workflow" },
  { key: "reports", label: "Reports", icon: "BarChart3" },
  { key: "settings", label: "Settings", icon: "Settings" },
];

export const kpis = [
  {
    key: "open",
    label: "Open now",
    value: 24,
    context: "of 63 handled this week",
    primary: true,
    trend: [14, 16, 15, 19, 18, 22, 20, 24],
  },
  {
    key: "overdue",
    label: "Overdue SLA",
    value: 5,
    context: "+2 since yesterday",
    trend: [2, 2, 3, 3, 4, 3, 4, 5],
  },
  {
    key: "unassigned",
    label: "Unassigned",
    value: 8,
    context: "3 flagged escalated",
    trend: [6, 7, 6, 8, 7, 9, 8, 8],
  },
  {
    key: "resolved",
    label: "Resolved today",
    value: 42,
    context: "avg. 18m to close",
    trend: [30, 34, 33, 38, 36, 40, 39, 42],
  },
];

export const filters = ["All", "Mine", "Unassigned", "Overdue", "Escalated"];

export const workItems = [
  {
    id: "OPS-2841",
    title: "Payment webhook retries failing",
    customer: "Northwind Logistics",
    status: "escalated",
    priority: "Urgent",
    assignee: { name: "Mara Diaz", initials: "MD" },
    age: "42m",
    overdue: true,
  },
  {
    id: "OPS-2839",
    title: "Bulk import stuck at 80%",
    customer: "Halcyon Freight",
    status: "in_progress",
    priority: "High",
    assignee: { name: "Theo Lund", initials: "TL" },
    age: "1h 10m",
    overdue: true,
  },
  {
    id: "OPS-2836",
    title: "Duplicate invoice sent to customer",
    customer: "Ferro Supply Co.",
    status: "open",
    priority: "High",
    assignee: null,
    age: "2h 5m",
    overdue: false,
  },
  {
    id: "OPS-2831",
    title: "SSO login loop after domain change",
    customer: "Berkline Group",
    status: "blocked",
    priority: "Urgent",
    assignee: { name: "Priya Nair", initials: "PN" },
    age: "3h 20m",
    overdue: true,
  },
  {
    id: "OPS-2828",
    title: "Rate limit hit on nightly sync",
    customer: "Anders Metalwork",
    status: "open",
    priority: "Medium",
    assignee: null,
    age: "4h 02m",
    overdue: false,
  },
  {
    id: "OPS-2822",
    title: "Refund approval pending finance sign-off",
    customer: "Coastal Retail Partners",
    status: "in_progress",
    priority: "Medium",
    assignee: { name: "Theo Lund", initials: "TL" },
    age: "5h 40m",
    overdue: false,
  },
  {
    id: "OPS-2819",
    title: "Onboarding checklist not triggering",
    customer: "Vestibule Analytics",
    status: "open",
    priority: "Low",
    assignee: { name: "Mara Diaz", initials: "MD" },
    age: "6h 15m",
    overdue: false,
  },
  {
    id: "OPS-2811",
    title: "API key rotation request",
    customer: "Bramwell Foods",
    status: "resolved",
    priority: "Low",
    assignee: { name: "Priya Nair", initials: "PN" },
    age: "8h 50m",
    overdue: false,
  },
];

export const statusMeta = {
  open: { label: "Open", color: "var(--gray-6)" },
  in_progress: { label: "In progress", color: "var(--accent)" },
  blocked: { label: "Blocked", color: "var(--danger)" },
  escalated: { label: "Escalated", color: "var(--danger)" },
  resolved: { label: "Resolved", color: "var(--success)" },
};
