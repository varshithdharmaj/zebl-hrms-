"use client";

import { cn } from "@/lib/utils";

export type TabDef = { id: string; label: string; count?: number };

export function AppTabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-border", className)}>
      <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative shrink-0 pb-3 text-sm font-medium transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {tab.count}
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-foreground" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
