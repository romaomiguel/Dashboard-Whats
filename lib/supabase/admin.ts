import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Cliente com service role: ignora RLS.
 * Uso restrito ao receptor de webhook, que não tem sessão de usuário.
 * Nunca importar em componente com 'use client'.
 */
export function criarClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
