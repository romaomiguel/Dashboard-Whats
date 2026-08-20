'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EstadoLogin } from './actions'

function BotaoEnviar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="mt-1 w-full gap-2" disabled={pending}>
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
        <Label htmlFor="email">E-mail</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com"
            className="pl-9"
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="senha">Senha</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="senha"
            name="senha"
            type={senhaVisivel ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Sua senha"
            className="pl-9 pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setSenhaVisivel((v) => !v)}
            aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            {senhaVisivel ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
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
