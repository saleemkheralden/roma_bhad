import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Browser client (singleton inside @supabase/ssr). Uses the publishable key only.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
