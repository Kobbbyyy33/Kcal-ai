import webpush from "web-push";

let configured = false;

export function canUseWebPush() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT
  );
}

export function ensureWebPushConfigured() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !sub) {
    throw new Error("Missing VAPID env vars");
  }
  webpush.setVapidDetails(sub, pub, priv);
  configured = true;
}

export { webpush };
