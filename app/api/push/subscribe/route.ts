import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabase/routeClient";
import { canUseWebPush } from "@/lib/push/webpush";

export const runtime = "nodejs";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(16),
    auth: z.string().min(8)
  })
});

export async function POST(request: Request) {
  if (!canUseWebPush()) {
    return NextResponse.json({ error: "Push not configured on server" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });

  const supabase = await supabaseRouteClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint, keys } = parsed.data;
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth
    },
    { onConflict: "endpoint" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
