import StatusDot from "./StatusDot.jsx";
import EmptyState from "./EmptyState.jsx";

const priorityColor = {
  Urgent: "text-danger",
  High: "text-gray-9",
  Medium: "text-gray-7",
  Low: "text-gray-6",
};

// The work queue IS the product in the Command composition: dominant,
// keyboard-navigable, row context via avatar + status dot + priority —
// never a plain spreadsheet grid.
export default function WorkQueueTable({ items, onReset }) {
  if (items.length === 0) {
    return (
      <div className="rounded-card bg-white shadow-card">
        <EmptyState onReset={onReset} />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card bg-white shadow-card">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-gray-2">
            <th className="w-[160px] px-4 py-2.5 text-[12px] font-medium text-gray-6">
              Status
            </th>
            <th className="px-4 py-2.5 text-[12px] font-medium text-gray-6">
              Item
            </th>
            <th className="px-4 py-2.5 text-[12px] font-medium text-gray-6">
              Customer
            </th>
            <th className="w-[140px] px-4 py-2.5 text-[12px] font-medium text-gray-6">
              Assignee
            </th>
            <th className="w-[90px] px-4 py-2.5 text-[12px] font-medium text-gray-6">
              Priority
            </th>
            <th className="w-[90px] px-4 py-2.5 text-right text-[12px] font-medium text-gray-6">
              Age
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              tabIndex={0}
              className="group h-12 cursor-pointer border-b border-gray-2 last:border-0 transition-colors duration-fast hover:bg-gray-1 focus-visible:outline-none focus-visible:bg-gray-1 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              <td className="px-4">
                <StatusDot status={item.status} />
              </td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[13px] text-gray-9">
                    {item.title}
                  </p>
                  {item.overdue && (
                    <span className="shrink-0 text-[11px] font-medium text-danger">
                      SLA
                    </span>
                  )}
                </div>
                <p className="text-[11px] tabular-nums text-gray-6">
                  {item.id}
                </p>
              </td>
              <td className="px-4 text-[13px] text-gray-7">{item.customer}</td>
              <td className="px-4">
                {item.assignee ? (
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-2 text-[10px] font-medium text-gray-7">
                      {item.assignee.initials}
                    </div>
                    <span className="truncate text-[13px] text-gray-7">
                      {item.assignee.name}
                    </span>
                  </div>
                ) : (
                  <span className="text-[13px] text-gray-6">Unassigned</span>
                )}
              </td>
              <td className={`px-4 text-[13px] font-medium ${priorityColor[item.priority]}`}>
                {item.priority}
              </td>
              <td className="px-4 text-right text-[13px] tabular-nums text-gray-6">
                {item.age}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
