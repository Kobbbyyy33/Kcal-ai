import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabase/routeClient";
import { canUseWebPush, ensureWebPushConfigured, webpush } from "@/lib/push/webpush";

export const runtime = "nodejs";

const schema = z.object({
  kind: z.enum(["hydration", "meal"])
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  if (!canUseWebPush()) return NextResponse.json({ error: "Push not configured on server" }, { status: 400 });

  const supabase = await supabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const subscriptions = subs ?? [];
  if (subscriptions.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  ensureWebPushConfigured();
  const payload =
    parsed.data.kind === "hydration"
      ? {
          title: "Hydratation",
          body: "Il est temps de boire un verre d'eau.",
          tag: "hydration-reminder",
          url: "/dashboard"
        }
      : {
          title: "Rappel repas",
          body: "Pense a enregistrer ton prochain repas.",
          tag: "meal-reminder",
          url: "/add-meal"
        };

  let sent = 0;
  for (const sub of subscriptions) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    };
    try {
      await webpush.sendNotification(pushSub, JSON.stringify(payload));
      sent += 1;
    } catch (err: any) {
      const statusCode = Number(err?.statusCode ?? 0);
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint).eq("user_id", user.id);
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
