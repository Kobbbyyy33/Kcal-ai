import { redirect } from "next/navigation";
import { Providers } from "@/components/Providers";
import { supabaseServer } from "@/lib/supabase/server";

export default async function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <Providers>{children}</Providers>;
}

