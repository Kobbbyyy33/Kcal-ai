"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Apple, Chrome } from "lucide-react";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toUserErrorMessage } from "@/lib/supabase/errors";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingApple, setLoadingApple] = useState(false);

  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-2xl font-bold">CrÃ©er un compte</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          Email + mot de passe (Supabase Auth).
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              const supabase = supabaseBrowser();
              const { data, error } = await supabase.auth.signUp({ email, password });
              if (error) throw error;

              if (data.user) {
                await supabase.from("profiles").upsert({ id: data.user.id, email });
              }

              toast.success("Compte crÃ©Ã©");
              router.replace("/dashboard");
            } catch (err) {
              toast.error(toUserErrorMessage(err, "Erreur de creation de compte"));
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
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: "google"
                });
                if (error) throw error;
              } catch (err) {
                toast.error(toUserErrorMessage(err, "Erreur Google"));
                setLoadingGoogle(false);
              }
            }}
          >
            <Chrome className="h-5 w-5" />
            Continuer avec Google
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full border border-slate-200 dark:border-slate-700"
            loading={loadingApple}
            onClick={async () => {
              setLoadingApple(true);
              try {
                const supabase = supabaseBrowser();
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: "apple"
                });
                if (error) throw error;
              } catch (err) {
                toast.error(toUserErrorMessage(err, "Erreur Apple"));
                setLoadingApple(false);
              }
            }}
          >
            <Apple className="h-5 w-5" />
            Continuer avec Apple
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>

          <Button type="submit" className="w-full" loading={loading}>
            CrÃ©er mon compte
          </Button>

          <p className="text-sm text-gray-600 dark:text-slate-400">
            DÃ©jÃ  un compte ?{" "}
            <Link className="text-primary hover:underline" href="/login">
              Se connecter
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}



