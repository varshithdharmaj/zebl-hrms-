"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "theme";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // The bootstrap script in the root layout already set the class before hydration —
  // this just reads it back so the icon matches. Gated on `mounted` because the server
  // has no DOM to read, so the first client render must match the server's markup.
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Storage can be unavailable (private browsing, disabled cookies) — the toggle
      // still works for the session, it just won't persist across reloads.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-lg border border-border p-2 hover:bg-muted"
      aria-label={mounted && isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={mounted && isDark}
      title={mounted && isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {mounted && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
