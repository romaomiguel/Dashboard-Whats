'use client'

import { Plus, QrCode } from 'lucide-react'
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

export function NovaConexaoDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="size-4" />
        Nova conexão
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conexão</DialogTitle>
          <DialogDescription>
            Dê um nome à instância e escaneie o QR Code no WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="conexao-nome">Nome da instância</Label>
            <Input id="conexao-nome" placeholder="Ex: Suporte Comercial" />
          </div>
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-6">
            <div className="flex size-40 items-center justify-center rounded-lg bg-background">
              <QrCode className="size-24 text-muted-foreground" strokeWidth={1} />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Abra o WhatsApp {'>'} Aparelhos conectados {'>'} Conectar aparelho e
              aponte a câmera para o código.
            </p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <DialogClose render={<Button />}>Concluir</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
