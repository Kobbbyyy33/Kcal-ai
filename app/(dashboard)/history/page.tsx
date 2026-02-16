"use client";

import { DashboardLayout } from "@/components/DashboardLayout";
import { HistoryView } from "@/components/HistoryView";

export default function HistoryPage() {
  return (
    <DashboardLayout title="Historique">
      <HistoryView />
    </DashboardLayout>
  );
}

