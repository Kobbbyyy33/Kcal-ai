"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { supabaseBrowser } from "@/lib/supabase/client";

export function Header({ title }: { title: string }) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-white/80 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/75">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <img
            src="/brand/Lime%20Green%20Modern%20Health%20%26%20Fitness%20Logo%20(1).png"
            alt="KcalIA"
            className="h-9 w-auto object-contain"
          />
          <div className="truncate text-xs text-slate-500 dark:text-slate-400">{title}</div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            className="px-3"
            aria-label="Deconnexion"
            onClick={async () => {
              try {
                const supabase = supabaseBrowser();
                await supabase.auth.signOut();
                toast.success("Deconnecte");
                router.replace("/login");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Erreur de deconnexion");
              }
            }}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
