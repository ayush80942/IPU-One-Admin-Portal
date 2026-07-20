import { LucideIcon } from "lucide-react";

export type StatColor = "primary" | "danger" | "success" | "info" | "teal" | "orange" | "violet" | "magenta";

// Tailwind's scanner needs literal class strings, not template-built ones
// (`text-${color}` would never be generated) — so every combination is
// spelled out here rather than interpolated.
const COLOR_CLASSES: Record<StatColor, { text: string; bgFaint: string }> = {
  primary: { text: "text-primary", bgFaint: "bg-primary-faint" },
  danger: { text: "text-danger", bgFaint: "bg-danger-faint" },
  success: { text: "text-success", bgFaint: "bg-success-faint" },
  info: { text: "text-info", bgFaint: "bg-info-faint" },
  teal: { text: "text-teal", bgFaint: "bg-teal-faint" },
  orange: { text: "text-orange", bgFaint: "bg-orange-faint" },
  violet: { text: "text-violet", bgFaint: "bg-violet-faint" },
  magenta: { text: "text-magenta", bgFaint: "bg-magenta-faint" },
};

interface StatTileProps {
  value: number | string;
  label: string;
  color?: StatColor;
  icon?: LucideIcon;
  subLabel?: string;
}

// Formalizes the stat-card pattern that was copy-pasted with drift across
// Notices/Courses/Documents (different grid layouts each time) and upgrades
// Students' ad hoc single-line stat to match.
export default function StatTile({ value, label, color = "primary", icon: Icon, subLabel }: StatTileProps) {
  const classes = COLOR_CLASSES[color];
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm flex items-start justify-between gap-3">
      <div>
        <div className={`text-3xl font-extrabold ${classes.text}`}>{value}</div>
        <div className="text-[13px] text-muted mt-1">{label}</div>
        {subLabel && <div className="text-[11px] text-muted/70 mt-0.5">{subLabel}</div>}
      </div>
      {Icon && (
        <div className={`shrink-0 w-10 h-10 rounded-xl ${classes.bgFaint} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${classes.text}`} />
        </div>
      )}
    </div>
  );
}
