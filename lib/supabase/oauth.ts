type OAuthNextPath = `/${string}`;

function normalizeNextPath(nextPath?: string): OAuthNextPath {
  if (!nextPath || !nextPath.startsWith("/")) return "/dashboard";
  return nextPath as OAuthNextPath;
}

export function buildOAuthRedirectTo(nextPath?: string) {
  if (typeof window === "undefined") return undefined;

  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", normalizeNextPath(nextPath));
  return url.toString();
}
