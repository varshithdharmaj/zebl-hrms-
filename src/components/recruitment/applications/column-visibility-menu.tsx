"use client";

import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, usePopoverState } from "@/components/ui/popover";
import { useLocalStorageState } from "@/lib/recruitment/shared/use-local-storage-state";

/**
 * Presentation-only. Every column here is already part of the authorized
 * list payload (Candidate/Application fields the session can already see) —
 * this menu only shows/hides columns client-side, it never requests new
 * data. Compensation/CTC is intentionally NOT an option here: exposing it
 * would need a per-row canEditCompensation check the list query doesn't
 * currently perform, so it stays off the customizable-column surface
 * entirely rather than being a client-side-only "hide".
 */
export const OPTIONAL_LIST_COLUMNS = [
  { key: "experience", label: "Experience" },
  { key: "currentCompany", label: "Current Company" },
  { key: "noticePeriod", label: "Notice Period" },
  { key: "location", label: "Location" },
  { key: "skills", label: "Skills" },
] as const;

export type OptionalListColumnKey = (typeof OPTIONAL_LIST_COLUMNS)[number]["key"];

const LIST_COLUMNS_STORAGE_KEY = "recruitment.pipeline.listColumns";

export function useVisibleListColumns() {
  return useLocalStorageState<OptionalListColumnKey[]>(LIST_COLUMNS_STORAGE_KEY, []);
}

export function ColumnVisibilityMenu({
  visible,
  onChange,
}: {
  visible: OptionalListColumnKey[];
  onChange: (visible: OptionalListColumnKey[]) => void;
}) {
  const menu = usePopoverState();
  const visibleSet = new Set(visible);

  const toggle = (key: OptionalListColumnKey) => {
    onChange(visibleSet.has(key) ? visible.filter((k) => k !== key) : [...visible, key]);
  };

  return (
    <Popover
      open={menu.open}
      onOpenChange={menu.setOpen}
      align="end"
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs font-semibold"
          onClick={() => menu.setOpen(!menu.open)}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Columns
        </Button>
      }
      contentClassName="w-56 p-2"
    >
      <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Optional columns
      </p>
      <div className="flex flex-col gap-1">
        {OPTIONAL_LIST_COLUMNS.map((col) => (
          <label
            key={col.key}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Checkbox
              checked={visibleSet.has(col.key)}
              onCheckedChange={() => toggle(col.key)}
            />
            {col.label}
          </label>
        ))}
      </div>
    </Popover>
  );
}
