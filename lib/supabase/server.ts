import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function criarClienteServidor() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (paraDefinir) => {
          try {
            for (const { name, value, options } of paraDefinir) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Components não podem escrever cookies.
            // O middleware já renova a sessão; ignorar é o comportamento correto.
          }
        },
      },
    },
  )
}
