'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { salvarPerfil, type EstadoPerfil } from './actions'

function BotaoSalvar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-fit" disabled={pending}>
      {pending ? 'Salvando...' : 'Salvar alterações'}
    </Button>
  )
}

export function FormularioPerfil({
  nome,
  email,
}: {
  nome: string
  email: string
}) {
  const [estado, enviar] = useActionState<EstadoPerfil, FormData>(salvarPerfil, {})

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" defaultValue={nome} maxLength={80} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" defaultValue={email} disabled readOnly />
        <p className="text-xs text-muted-foreground">
          O e-mail é o identificador da conta e não pode ser alterado aqui.
        </p>
      </div>

      {estado.erro && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/12 px-3 py-2 text-sm text-destructive"
        >
          {estado.erro}
        </p>
      )}

      {estado.ok && (
        <p role="status" className="text-sm text-primary">
          Perfil salvo.
        </p>
      )}

      <BotaoSalvar />
    </form>
  )
}
