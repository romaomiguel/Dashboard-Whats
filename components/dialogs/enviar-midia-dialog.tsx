'use client'

import { CloudUpload, Upload } from 'lucide-react'
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

export function EnviarMidiaDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Upload className="size-4" />
        Enviar mídia
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar mídia</DialogTitle>
          <DialogDescription>
            Adicione um arquivo à biblioteca de mídias.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <label
            htmlFor="midia-file"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-8 text-center transition-colors hover:bg-muted/70"
          >
            <CloudUpload className="size-8 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Clique para selecionar ou arraste o arquivo
            </span>
            <span className="text-xs text-muted-foreground">
              Imagens, vídeos, áudios ou documentos até 16 MB
            </span>
            <Input id="midia-file" type="file" className="hidden" />
          </label>
          <div className="flex flex-col gap-2">
            <Label htmlFor="midia-legenda">Legenda (opcional)</Label>
            <Textarea
              id="midia-legenda"
              rows={3}
              placeholder="Adicione uma legenda para a mídia..."
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <DialogClose render={<Button className="gap-2" />}>
            <Upload className="size-4" />
            Enviar
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
