"use client";

import { DashboardLayout } from "@/components/DashboardLayout";
import { ScanView } from "@/components/ScanView";

export default function ScanPage() {
  return (
    <DashboardLayout title="Scanner un code-barres">
      <ScanView />
    </DashboardLayout>
  );
}

