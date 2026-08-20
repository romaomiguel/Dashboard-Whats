'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Plus } from 'lucide-react'
import {
  criarContato,
  type EstadoContato,
} from '@/app/(app)/contatos/actions'
import { LIMITE_NOME, LIMITE_NUMERO } from '@/lib/contatos'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Etiqueta } from '@/lib/etiquetas'

function BotaoSalvar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando...' : 'Salvar contato'}
    </Button>
  )
}

export function NovoContatoDialog({ etiquetas }: { etiquetas: Etiqueta[] }) {
  const [aberto, setAberto] = useState(false)
  const [etiquetaId, setEtiquetaId] = useState('')
  const [estado, enviar] = useActionState<EstadoContato, FormData>(criarContato, {})

  // Fecha só depois que a ação confirmou a gravação: fechar no clique
  // esconderia o erro de um contato que não entrou.
  useEffect(() => {
    if (estado.ok) {
      setAberto(false)
      setEtiquetaId('')
    }
  }, [estado])

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="size-4" />
        Novo contato
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo contato</DialogTitle>
          <DialogDescription>Cadastre um novo contato na sua base.</DialogDescription>
        </DialogHeader>

        <form action={enviar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="contato-nome">Nome</Label>
            <Input
              id="contato-nome"
              name="nome"
              placeholder="Nome completo"
              maxLength={LIMITE_NOME}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contato-numero">Número de WhatsApp</Label>
            <Input
              id="contato-numero"
              name="numero"
              placeholder="+55 11 91234-5678"
              maxLength={LIMITE_NUMERO}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="contato-tag">Etiqueta</Label>
            <input type="hidden" name="etiqueta_id" value={etiquetaId} />
            {etiquetas.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                Nenhuma etiqueta cadastrada. Crie as suas em Configurações.
              </p>
            ) : (
              <Select
                value={etiquetaId}
                onValueChange={(valor) => setEtiquetaId(String(valor ?? ''))}
              >
                <SelectTrigger id="contato-tag">
                  <SelectValue placeholder="Selecionar etiqueta" />
                </SelectTrigger>
                <SelectContent>
                  {etiquetas.map((etiqueta) => (
                    <SelectItem key={etiqueta.id} value={etiqueta.id}>
                      {etiqueta.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {estado.erro && (
            <p role="alert" className="text-sm text-destructive">
              {estado.erro}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <BotaoSalvar />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
