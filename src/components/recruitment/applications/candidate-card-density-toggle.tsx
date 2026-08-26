"use client";

import { Button } from "@/components/ui/button";
import { useLocalStorageState } from "@/lib/recruitment/shared/use-local-storage-state";

export type CardDensity = "comfortable" | "compact";

const CARD_DENSITY_STORAGE_KEY = "recruitment.pipeline.cardDensity";

/** Level-1 client-side preference — persisted to localStorage, no database table. */
export function useCardDensity() {
  return useLocalStorageState<CardDensity>(CARD_DENSITY_STORAGE_KEY, "comfortable");
}

export function CandidateCardDensityToggle({
  density,
  onChange,
}: {
  density: CardDensity;
  onChange: (density: CardDensity) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted p-1">
      <Button
        type="button"
        variant={density === "comfortable" ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2.5 text-xs font-semibold"
        onClick={() => onChange("comfortable")}
      >
        Comfortable
      </Button>
      <Button
        type="button"
        variant={density === "compact" ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2.5 text-xs font-semibold"
        onClick={() => onChange("compact")}
      >
        Compact
      </Button>
    </div>
  );
}
