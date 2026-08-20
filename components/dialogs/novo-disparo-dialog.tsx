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
import { conexoes } from '@/lib/data'

export function NovoDisparoDialog() {
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
              <Select>
                <SelectTrigger id="disparo-conexao">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {conexoes.map((c) => (
                    <SelectItem key={c.numero} value={c.numero}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="disparo-publico">Público</Label>
              <Select>
                <SelectTrigger id="disparo-publico">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os contatos</SelectItem>
                  <SelectItem value="vip">Apenas VIP</SelectItem>
                  <SelectItem value="clientes">Clientes</SelectItem>
                  <SelectItem value="leads">Leads</SelectItem>
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
