'use client'

import { Plus, Send } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDadosExemplo } from '@/components/dados-exemplo-provider'
import { conexoes } from '@/lib/data'
import type { Etiqueta } from '@/lib/etiquetas'

export function NovoDisparoDialog({ etiquetas }: { etiquetas: Etiqueta[] }) {
  const { mostrarExemplo } = useDadosExemplo()

  // Conexão real só existe a partir da Entrega 2. Até lá a lista vem do
  // exemplo — e some junto com ele ao zerar, em vez de oferecer quatro
  // aparelhos que não existem.
  const listaConexoes = mostrarExemplo ? conexoes : []

  // items mapeia valor -> rótulo. Sem ele o Base UI mostra no gatilho o valor
  // cru: 'todos' em minúsculo e o uuid da etiqueta em vez do nome.
  const itensConexao = Object.fromEntries(
    listaConexoes.map((c) => [c.numero, c.nome]),
  )
  const itensPublico = {
    todos: 'Todos os contatos',
    ...Object.fromEntries(etiquetas.map((e) => [e.id, e.nome])),
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="size-4" />
        Novo disparo
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo disparo</DialogTitle>
          <DialogDescription>
            Configure uma nova campanha de mensagens em massa.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="disparo-nome">Nome da campanha</Label>
            <Input id="disparo-nome" placeholder="Ex: Promoção de Natal" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="disparo-conexao">Conexão</Label>
              {listaConexoes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                  Nenhuma conexão. Conecte um WhatsApp em Conexão.
                </p>
              ) : (
              <Select items={itensConexao}>
                <SelectTrigger id="disparo-conexao">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {listaConexoes.map((c) => (
                    <SelectItem key={c.numero} value={c.numero}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="disparo-publico">Público</Label>
              <Select items={itensPublico}>
                <SelectTrigger id="disparo-publico">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os contatos</SelectItem>
                  {/* Público sai das etiquetas que o usuário cadastrou; a
                      lista fixa de antes citava grupos que não existiam. */}
                  {etiquetas.map((etiqueta) => (
                    <SelectItem key={etiqueta.id} value={etiqueta.id}>
                      {etiqueta.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="disparo-msg">Mensagem</Label>
            <Textarea
              id="disparo-msg"
              rows={4}
              placeholder="Escreva a mensagem que será enviada..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="disparo-data">Agendar envio</Label>
            <Input id="disparo-data" type="datetime-local" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <DialogClose render={<Button className="gap-2" />}>
            <Send className="size-4" />
            Criar disparo
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
