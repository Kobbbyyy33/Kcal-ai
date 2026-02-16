"use client";

import { DashboardLayout } from "@/components/DashboardLayout";
import { SettingsView } from "@/components/SettingsView";

export default function SettingsPage() {
  return (
    <DashboardLayout title="Parametres">
      <SettingsView />
    </DashboardLayout>
  );
}

