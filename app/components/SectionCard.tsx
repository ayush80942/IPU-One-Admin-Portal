import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// The titled-card-with-an-icon wrapper every detail page (Students, Institutes) stacks its
// sections in - shared here so the two can't drift apart on padding/border/heading style.
export default function SectionCard({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-primary flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {title}
        </h2>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
