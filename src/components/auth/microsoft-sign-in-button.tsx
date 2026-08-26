"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MicrosoftSignInButton({
  returnTo,
  enabled,
}: {
  returnTo?: string;
  enabled: boolean;
}) {
  const [loading, setLoading] = useState(false);

  if (!enabled) return null;

  const href =
    `/api/auth/microsoft` +
    (returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "");

  return (
    <Button
      type="button"
      variant="default"
      className="w-full bg-[#2f2f2f] hover:bg-[#1f1f1f] text-white"
      disabled={loading}
      onClick={() => {
        setLoading(true);
        window.location.href = href;
      }}
    >
      {loading ? "Redirecting to Microsoft…" : (
        <span className="flex items-center justify-center gap-2">
          <MicrosoftIcon />
          Sign in with Microsoft
        </span>
      )}
    </Button>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
