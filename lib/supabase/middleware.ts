import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const ROTAS_PUBLICAS = ['/login', '/api/webhooks']

/**
 * Para onde voltar depois do login: caminho mais query, nunca a origem.
 * Guardar só o pathname perdia filtros — quem caía no login vindo de
 * /contatos?busca=X voltava para a lista inteira.
 */
export function destinoDeRetorno(url: { pathname: string; search: string }) {
  return `${url.pathname}${url.search}`
}

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
    const destino = destinoDeRetorno(request.nextUrl)
    url.pathname = '/login'
    // Zerar a query antes: senão os parâmetros da rota original ficam
    // pendurados no /login junto com o destino.
    url.search = ''
    url.searchParams.set('destino', destino)
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
