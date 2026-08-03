import { useMemo, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import KpiCard from "./components/KpiCard.jsx";
import FilterBar from "./components/FilterBar.jsx";
import WorkQueueTable from "./components/WorkQueueTable.jsx";
import { kpis, filters, workItems } from "./data/mockData.js";

export default function App() {
  const [activeNav, setActiveNav] = useState("queue");
  const [activeFilter, setActiveFilter] = useState("All");

  const filteredItems = useMemo(() => {
    switch (activeFilter) {
      case "Mine":
        return workItems.filter((item) => item.assignee?.name === "Mara Diaz");
      case "Unassigned":
        return workItems.filter((item) => !item.assignee);
      case "Overdue":
        return workItems.filter((item) => item.overdue);
      case "Escalated":
        return workItems.filter((item) => item.status === "escalated");
      default:
        return workItems;
    }
  }, [activeFilter]);

  return (
    <div className="flex h-screen bg-gray-0">
      <Sidebar active={activeNav} onNavigate={setActiveNav} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <FilterBar
          filters={filters}
          active={activeFilter}
          onSelect={setActiveFilter}
          onReset={() => setActiveFilter("All")}
          hasCustomFilter={activeFilter !== "All"}
        />

        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-4 gap-4">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.key} {...kpi} />
            ))}
          </div>

          <div className="mt-6">
            <WorkQueueTable
              items={filteredItems}
              onReset={() => setActiveFilter("All")}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
