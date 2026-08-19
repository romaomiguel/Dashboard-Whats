import { MessageSquareText } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { entrar } from './actions'
import { FormularioLogin } from './formulario-login'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>
}) {
  const { destino } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MessageSquareText className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-foreground">ZapCRM</p>
            <p className="text-xs text-muted-foreground">Painel WhatsApp</p>
          </div>
        </div>

        <h1 className="mb-1 text-xl font-semibold tracking-tight text-foreground">
          Entrar
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Use as credenciais fornecidas pelo administrador.
        </p>

        <FormularioLogin acao={entrar} destino={destino ?? '/'} />
      </Card>
    </div>
  )
}
