import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function IndexPage() {
  const supabase = await supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  redirect("/dashboard");
}

