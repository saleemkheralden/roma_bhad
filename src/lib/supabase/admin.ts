import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Server-only client with the Supabase secret key. It bypasses RLS, so use it only for
 * work no single user may do themselves: sending notifications to other users, the
 * evening summary, and deleting one's own auth account. Never import from client code.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
