export function getPublicSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function getServerSupabaseConfig() {
  return {
    ...getPublicSupabaseConfig(),
    secretKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "packet-documents",
  };
}

export function isSupabaseConfigured() {
  const config = getPublicSupabaseConfig();
  return Boolean(config.url && config.publishableKey);
}

export function isSupabaseAdminConfigured() {
  const config = getServerSupabaseConfig();
  return Boolean(config.url && config.secretKey);
}
