"use client";

import * as React from "react";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";

export function DashboardLayout({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#f9b61a26_0%,_#f8fafc_45%,_#f6f7f2_100%)] dark:bg-[radial-gradient(ellipse_at_top,_#21502c_0%,_#0b1a12_55%,_#07110c_100%)]">
      <Header title={title} />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
