import { createClient, SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let gmvClient: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let inventoryClient: any = null;

export function getGmvSupabase(): SupabaseClient {
  if (!gmvClient) {
    gmvClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { db: { schema: 'gmv_tracker' }, auth: { persistSession: false } }
    );
  }
  return gmvClient;
}

export function getInventorySupabase(): SupabaseClient {
  if (!inventoryClient) {
    inventoryClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { db: { schema: 'inventory' }, auth: { persistSession: false } }
    );
  }
  return inventoryClient;
}
