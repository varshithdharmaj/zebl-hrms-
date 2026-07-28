import { KeyRound, Shield, Smartphone, BellRing } from "lucide-react";

const FEATURES = [
  {
    icon: KeyRound,
    title: "Password",
    description: "Change your password from account settings when available.",
    status: "Available via account settings",
  },
  {
    icon: Shield,
    title: "Two-Factor Authentication",
    description: "Add a second factor to protect sign-in.",
    status: "Coming Soon",
  },
  {
    icon: Smartphone,
    title: "Trusted Devices",
    description: "Mark devices you trust to reduce repeat verification.",
    status: "Coming Soon",
  },
  {
    icon: BellRing,
    title: "Recent Security Alerts",
    description: "Review unusual sign-in and account activity alerts.",
    status: "Coming Soon",
  },
] as const;

export function SecurityPlaceholderCard() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label="Security features">
      {FEATURES.map((feature) => {
        const Icon = feature.icon;
        return (
          <li
            key={feature.title}
            className="rounded-xl border border-dashed border-border bg-muted/20 p-4"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-subtle">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{feature.title}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                    {feature.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
