import { MessageSquareText } from 'lucide-react'
import { entrar } from './actions'
import { FormularioLogin } from './formulario-login'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>
}) {
  const { destino } = await searchParams

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Painel de marca */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MessageSquareText className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-sidebar-foreground">ZapCRM</p>
            <p className="text-xs text-muted-foreground">Painel WhatsApp</p>
          </div>
        </div>

        <div className="max-w-md">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-sidebar-foreground">
            Gerencie conexões, contatos e disparos de WhatsApp em um só lugar.
          </h2>
          <p className="mt-4 text-pretty text-sm leading-relaxed text-muted-foreground">
            Monitore suas instâncias em tempo real, acompanhe conversas e
            dispare campanhas com uma visão completa da operação.
          </p>
        </div>

        <div className="flex w-fit items-center gap-2 rounded-lg bg-sidebar-accent/60 px-3 py-2.5">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          <p className="text-xs text-muted-foreground">
            Sistema online e monitorando
          </p>
        </div>
      </section>

      {/* Formulário */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <MessageSquareText className="size-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">ZapCRM</p>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Entrar na conta
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Acesse o painel com seu e-mail e senha.
          </p>

          <FormularioLogin acao={entrar} destino={destino ?? '/'} />
        </div>
      </section>
    </main>
  )
}
