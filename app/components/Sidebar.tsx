"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone, Users, FileCheck2, GraduationCap } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/notices", label: "Notices", icon: Megaphone },
  { href: "/students", label: "Students", icon: Users },
  { href: "/documents", label: "Documents", icon: FileCheck2 },
  { href: "/courses", label: "Courses", icon: GraduationCap },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[250px] bg-surface border-r border-border flex flex-col p-6 sticky top-0 h-screen shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-9">
        <Image
          src="/logo.png"
          alt="GGSIPU"
          width={40}
          height={40}
          className="rounded-full shrink-0"
        />
        <div>
          <div className="font-bold text-[15px] text-primary leading-tight">IPU One</div>
          <div className="text-[11px] text-muted leading-tight">Student Cell Portal</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-[10px] px-3.5 py-[11px] rounded-[10px] text-[14px] font-medium transition-all duration-150 no-underline ${
                isActive
                  ? "bg-primary-faint text-primary font-bold"
                  : "text-muted hover:bg-primary-faint hover:text-primary"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom version */}
      <div className="mt-auto pt-6 text-[11px] text-muted/50">
        v0.1.0 • Student Cell
      </div>
    </aside>
  );
}
