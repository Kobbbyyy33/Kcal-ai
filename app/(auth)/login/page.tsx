"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Chrome } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { buildOAuthRedirectTo } from "@/lib/supabase/oauth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") ?? "/dashboard", [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();
      if (data.session) router.replace(next);
    })();
  }, [next, router]);

  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">Connexion</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">Connecte-toi pour acceder a ton dashboard.</p>

        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              const supabase = supabaseBrowser();
              const { error } = await supabase.auth.signInWithPassword({ email, password });
              if (error) throw error;
              toast.success("Connecte");
              router.replace(next);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Erreur de connexion");
            } finally {
              setLoading(false);
            }
          }}
        >
          <Button
            type="button"
            variant="ghost"
            className="w-full border border-slate-200 dark:border-slate-700"
            loading={loadingGoogle}
            onClick={async () => {
              setLoadingGoogle(true);
              try {
                const supabase = supabaseBrowser();
                const redirectTo = buildOAuthRedirectTo(next);
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo }
                });
                if (error) throw error;
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Erreur Google");
                setLoadingGoogle(false);
              }
            }}
          >
            <Chrome className="h-5 w-5" />
            Continuer avec Google
          </Button>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            ou
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Mot de passe</span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <Button type="submit" className="w-full" loading={loading}>
            Se connecter
          </Button>

          <p className="text-sm text-gray-600 dark:text-slate-400">
            Pas de compte ?{" "}
            <Link className="text-primary hover:underline" href="/signup">
              Creer un compte
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <LoginForm />
    </Suspense>
  );
}
