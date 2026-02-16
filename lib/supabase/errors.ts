export function toUserErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;

  const maybe = error as { code?: string; message?: string };
  const code = maybe.code ?? "";
  const message = maybe.message ?? "";

  const missingTableMatch = message.match(/Could not find the table 'public\.([a-zA-Z0-9_]+)'/);
  if (missingTableMatch) {
    const table = missingTableMatch[1];
    return `Table Supabase manquante: public.${table}. Execute supabase/schema.sql dans SQL Editor puis reconnecte-toi.`;
  }

  if (code === "PGRST205" || code === "42P01") {
    return "Schema Supabase non initialise. Execute supabase/schema.sql dans SQL Editor puis reconnecte-toi.";
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
