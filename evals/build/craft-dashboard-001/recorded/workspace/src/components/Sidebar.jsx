import {
  BarChart3,
  Building2,
  ListChecks,
  Settings,
  Workflow,
} from "lucide-react";
import { navItems } from "../data/mockData.js";

const icons = { ListChecks, Building2, Workflow, BarChart3, Settings };

// Signature bet: distinctive nav active indicator — a left accent bar +
// accent/10 fill + accent text, consistent everywhere active state appears.
export default function Sidebar({ active, onNavigate }) {
  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col justify-between bg-gray-1 px-3 py-4">
      <div>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-on-accent">
            <span className="text-[13px] font-bold">F</span>
          </div>
          <span className="text-[14px] font-semibold tracking-[-0.01em] text-gray-9">
            Flowline
          </span>
        </div>

        <nav aria-label="Main navigation" className="mt-6 flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = icons[item.icon];
            const isActive = item.key === active;
            return (
              <button
                key={item.key}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => onNavigate(item.key)}
                className={`group relative flex items-center gap-2.5 rounded-input py-2 pl-3 pr-2 text-left text-[13px] transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 ${
                  isActive
                    ? "bg-accent-tint font-medium text-accent"
                    : "text-gray-7 hover:bg-gray-2 hover:text-gray-9"
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent transition-opacity duration-fast ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                  aria-hidden="true"
                />
                <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2 rounded-input px-2 py-2 hover:bg-gray-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-3 text-[11px] font-medium text-gray-9">
          EC
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-gray-9">
            Eduardo Calvo
          </p>
          <p className="truncate text-[11px] text-gray-6">Ops lead</p>
        </div>
      </div>
    </aside>
  );
}
