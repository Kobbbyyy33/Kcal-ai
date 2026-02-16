"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { DraftMeal } from "@/components/DraftMealEditor";

async function fileToBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Lecture fichier impossible"));
    reader.readAsDataURL(file);
  });
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error("Format image invalide");
  return { mediaType: match[1], base64: match[2] };
}

export function PhotoUploader({
  onAnalyzed
}: {
  onAnalyzed: (draft: DraftMeal, imageUrl: string | null) => void;
}) {
  const [busy, setBusy] = React.useState(false);

  async function uploadToSupabase(file: File) {
    const supabase = supabaseBrowser();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Non connecté");

    const path = `${user.id}/${Date.now()}-${file.name.replaceAll(" ", "_")}`;
    const { error } = await supabase.storage.from("meal-images").upload(path, file, {
      upsert: false,
      contentType: file.type
    });

    if (error) throw error;

    const { data } = supabase.storage.from("meal-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function analyze(file: File) {
    if (file.size > 5 * 1024 * 1024) throw new Error("Image > 5MB");
    setBusy(true);
    try {
      const [{ mediaType, base64 }, imageUrl] = await Promise.all([fileToBase64(file), uploadToSupabase(file).catch(() => null)]);

      const res = await fetch("/api/analyze-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Erreur analyse");
      }

      const json = (await res.json()) as DraftMeal;
      onAnalyzed(
        {
          meal_name: json.meal_name,
          items: json.items.map((it) => ({ ...it, source: "ai" })),
          confidence: json.confidence
        },
        imageUrl
      );
      toast.success("Analyse terminée");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="text-sm font-semibold">Analyse d’une photo</div>
      <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
        Prends une photo ou upload une image (max 5MB). L’analyse est faite via OpenAI Vision côté serveur.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-primary px-6 py-3 text-base font-medium text-white transition-colors hover:bg-emerald-600 min-h-[44px]">
          {busy ? "Analyse…" : "Choisir une photo"}
          <input
            className="hidden"
            type="file"
            accept="image/*"
            capture="environment"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              analyze(file).catch((err) => toast.error(err instanceof Error ? err.message : "Erreur analyse"));
              e.currentTarget.value = "";
            }}
          />
        </label>

        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => toast.message("Astuce", { description: "Sur mobile, utilise l’option caméra pour une meilleure détection." })}
        >
          Conseils
        </Button>
      </div>
    </Card>
  );
}
