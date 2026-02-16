"use client";

import { Home, PlusCircle, QrCode, History, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Accueil", icon: Home },
  { href: "/add-meal", label: "Ajouter", icon: PlusCircle },
  { href: "/scan", label: "Scanner", icon: QrCode },
  { href: "/history", label: "Historique", icon: History },
  { href: "/settings", label: "Reglages", icon: Settings }
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-3 left-0 right-0 z-40">
      <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1 rounded-3xl border border-white/80 bg-white/90 px-2 py-2 shadow-[0_10px_30px_rgba(16,185,129,0.2)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/90">
        {items.map((it) => {
          const active = pathname === it.href;
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs",
                active
                  ? "bg-gradient-to-r from-[#7da03c] to-[#e55f15] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="leading-none">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
