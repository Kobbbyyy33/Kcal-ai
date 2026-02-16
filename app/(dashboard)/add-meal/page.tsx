"use client";

import { DashboardLayout } from "@/components/DashboardLayout";
import { AddMealView } from "@/components/AddMealView";

export default function AddMealPage() {
  return (
    <DashboardLayout title="Ajouter un repas">
      <AddMealView />
    </DashboardLayout>
  );
}

