'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { EstadoLogin } from './actions'

function BotaoEnviar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
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

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="destino" value={destino} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          E-mail
        </label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="senha" className="text-sm font-medium text-foreground">
          Senha
        </label>
        <Input
          id="senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {estado.erro && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/12 px-3 py-2 text-sm text-destructive"
        >
          {estado.erro}
        </p>
      )}

      <BotaoEnviar />
    </form>
  )
}
