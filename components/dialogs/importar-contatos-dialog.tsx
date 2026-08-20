'use client'

import { CloudUpload, FileSpreadsheet, Upload } from 'lucide-react'
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

export function ImportarContatosDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" className="gap-2" />}>
        <Upload className="size-4" />
        Importar
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
          <DialogDescription>
            Envie um arquivo CSV ou Excel com seus contatos.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <label
            htmlFor="import-file"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-8 text-center transition-colors hover:bg-muted/70"
          >
            <CloudUpload className="size-8 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Clique para selecionar o arquivo
            </span>
            <span className="text-xs text-muted-foreground">
              Formatos aceitos: .csv, .xlsx
            </span>
            <Input id="import-file" type="file" className="hidden" />
          </label>
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            <FileSpreadsheet className="size-4 shrink-0 text-primary" />
            As colunas devem seguir a ordem: Nome, Número, Etiqueta.
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
          <DialogClose render={<Button className="gap-2" />}>
            <Upload className="size-4" />
            Importar
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
