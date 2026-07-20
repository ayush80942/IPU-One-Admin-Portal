import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

// Shared page header — replaces the hand-rolled h1/p pair every page used to
// duplicate independently, with drifting spacing/structure between them.
export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-7">
      <div>
        <h1 className="text-2xl font-bold text-primary">{title}</h1>
        {subtitle && <p className="text-[14px] text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
