import { ReactNode } from "react";

interface PillProps {
  color: string;
  colorFaint: string;
  children: ReactNode;
}

// Shared rounded-pill styling, previously duplicated inline across the
// notices/students/documents tables with slightly different classes each time.
export default function Pill({ color, colorFaint, children }: PillProps) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${colorFaint} ${color}`}>
      {children}
    </span>
  );
}
