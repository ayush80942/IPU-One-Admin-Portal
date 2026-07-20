import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
}

// Was present on 2 of 4 tables and absent on the other 2 — now consistent everywhere.
export default function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className="py-16 text-center">
      <Icon className="w-12 h-12 mx-auto mb-3 text-muted/30" strokeWidth={1.5} />
      <p className="text-muted text-[14px]">{message}</p>
    </div>
  );
}
