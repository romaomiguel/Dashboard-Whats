'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { EstadoLogin } from './actions'

/** O Input do design system nasce compacto (h-8, text-sm); num login isso
    aperta demais, então a tela pede campos altos e texto de leitura. */
const CLASSE_CAMPO = 'h-11 pl-11 text-base md:text-base'

function BotaoEnviar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="mt-1 h-11 w-full gap-2 text-base" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? 'Entrando...' : 'Entrar'}
    </Button>
  )
}

export function FormularioLogin({
  acao,
  destino = '/',
  estadoInicial = {},
}: {
  acao: (estado: EstadoLogin, formData: FormData) => Promise<EstadoLogin>
  destino?: string
  estadoInicial?: EstadoLogin
}) {
  const [estado, enviar] = useActionState(acao, estadoInicial)
  const [senhaVisivel, setSenhaVisivel] = useState(false)

  return (
    <form action={enviar} className="mt-8 flex flex-col gap-5">
      <input type="hidden" name="destino" value={destino} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-base">E-mail</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            className={CLASSE_CAMPO}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="senha" className="text-base">Senha</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <Input
            id="senha"
            name="senha"
            type={senhaVisivel ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Sua senha"
            className={cn(CLASSE_CAMPO, "pr-11")}
            required
          />
          <button
            type="button"
            onClick={() => setSenhaVisivel((v) => !v)}
            aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            {senhaVisivel ? (
              <EyeOff className="size-[18px]" />
            ) : (
              <Eye className="size-[18px]" />
            )}
          </button>
        </div>
      </div>

      {estado.erro && (
        <p role="alert" className="text-sm text-destructive">
          {estado.erro}
        </p>
      )}

      <BotaoEnviar />
    </form>
  )
}
