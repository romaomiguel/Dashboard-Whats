'use client'

import { Plus } from 'lucide-react'
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

export function NovoContatoDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="size-4" />
        Novo contato
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo contato</DialogTitle>
          <DialogDescription>
            Cadastre um novo contato na sua base.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="contato-nome">Nome</Label>
            <Input id="contato-nome" placeholder="Nome completo" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contato-numero">Número de WhatsApp</Label>
            <Input id="contato-numero" placeholder="+55 11 91234-5678" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="contato-tag">Etiqueta</Label>
            <Select>
              <SelectTrigger id="contato-tag">
                <SelectValue placeholder="Selecionar etiqueta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cliente">Cliente</SelectItem>
                <SelectItem value="Lead">Lead</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <DialogClose render={<Button />}>Salvar contato</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
