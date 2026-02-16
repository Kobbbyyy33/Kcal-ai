"use client";

import * as React from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useStore } from "@/lib/store/useStore";

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("theme");
    const initial = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    applyTheme(initial);
  }, [setTheme]);

  React.useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem("theme", theme);

    // Best-effort sync in profile.
    (async () => {
      try {
        const supabase = supabaseBrowser();
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from("profiles").upsert({ id: user.id, email: user.email ?? null, theme });
      } catch {
        // ignore
      }
    })();
  }, [theme]);

  return <>{children}</>;
}

