"use client";

import Image from "next/image";
import Link from "next/link";
import { clearSession } from "../lib/auth";
import { navItemsFor } from "../lib/nav";
import { useAdminSession } from "./AuthGate";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function Sidebar() {
  const router = useRouter();
  const session = useAdminSession();

  const signOut = () => {
    clearSession();
    router.replace("/login");
  };

  const pathname = usePathname();
  const navItems = navItemsFor(session);

  return (
    <aside className="w-[250px] bg-surface border-r border-border flex flex-col p-6 sticky top-0 h-screen shrink-0">
      {/* Logo */}
      <div className="mb-9 flex justify-center">
        <Image
          src="/logo.png"
          alt="IPU One"
          width={180}
          height={108}
          className="h-11 w-auto shrink-0"
        />
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto">
        {navItems.map((item) => {
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

      {/* Signed-in account + sign out */}
      <div className="mt-auto pt-6 border-t border-border">
        {session && (
          <div className="mb-2">
            <div className="text-[12px] font-semibold text-foreground truncate" title={session.displayName}>
              {session.displayName}
            </div>
            <div className="text-[11px] text-muted truncate" title={session.email}>
              {session.email}
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-[13px] font-medium text-muted hover:text-primary transition-colors"
        >
          <LogOut className="w-4 h-4" strokeWidth={2} />
          Sign out
        </button>
        <div className="mt-4 text-[11px] text-muted/50">
          v0.1.0 • {session?.role === "SUPER_ADMIN" ? "University" : "Student Cell"}
        </div>
      </div>
    </aside>
  );
}
