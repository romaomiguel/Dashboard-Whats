import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const ROTAS_PUBLICAS = ['/login', '/api/webhooks']

export function ehRotaPublica(caminho: string) {
  return ROTAS_PUBLICAS.some(
    (rota) => caminho === rota || caminho.startsWith(`${rota}/`),
  )
}

export async function atualizarSessao(request: NextRequest) {
  let resposta = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (paraDefinir) => {
          for (const { name, value } of paraDefinir) {
            request.cookies.set(name, value)
          }
          resposta = NextResponse.next({ request })
          for (const { name, value, options } of paraDefinir) {
            resposta.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // getUser() valida o token no servidor. Não trocar por getSession(),
  // que apenas lê o cookie e pode ser forjado.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const caminho = request.nextUrl.pathname

  if (!user && !ehRotaPublica(caminho)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('destino', caminho)
    return NextResponse.redirect(url)
  }

  if (user && caminho === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return resposta
}
