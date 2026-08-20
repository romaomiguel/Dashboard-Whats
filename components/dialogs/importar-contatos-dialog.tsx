'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { CloudUpload, FileSpreadsheet, Upload } from 'lucide-react'
import {
  importarContatos,
  type EstadoContato,
} from '@/app/(app)/contatos/actions'
import { LIMITE_IMPORTACAO } from '@/lib/contatos'
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

function BotaoImportar({ pronto }: { pronto: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="gap-2" disabled={pending || !pronto}>
      <Upload className="size-4" />
      {pending ? 'Importando...' : 'Importar'}
    </Button>
  )
}

export function ImportarContatosDialog() {
  const [aberto, setAberto] = useState(false)
  const [arquivo, setArquivo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [erroLeitura, setErroLeitura] = useState('')
  const entrada = useRef<HTMLInputElement>(null)
  const [estado, enviar] = useActionState<EstadoContato, FormData>(
    importarContatos,
    {},
  )

  useEffect(() => {
    if (estado.ok) {
      setAberto(false)
      setArquivo('')
      setConteudo('')
      if (entrada.current) entrada.current.value = ''
    }
  }, [estado])

  async function lerArquivo(evento: React.ChangeEvent<HTMLInputElement>) {
    setErroLeitura('')
    const escolhido = evento.target.files?.[0]
    if (!escolhido) return

    // O .xlsx é binário; lê-lo como texto só produziria lixo, então vale
    // dizer isso antes de mandar qualquer coisa ao servidor.
    if (/\.xlsx?$/i.test(escolhido.name)) {
      setErroLeitura('Salve a planilha como CSV e envie de novo.')
      setArquivo('')
      setConteudo('')
      return
    }

    setArquivo(escolhido.name)
    setConteudo(await escolhido.text())
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button variant="outline" className="gap-2" />}>
        <Upload className="size-4" />
        Importar
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
          <DialogDescription>
            Envie um arquivo CSV com seus contatos.
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="flex flex-col gap-4">
          <input type="hidden" name="conteudo" value={conteudo} />

          <label
            htmlFor="import-file"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-8 text-center transition-colors hover:bg-muted/70"
          >
            <CloudUpload className="size-8 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {arquivo || 'Clique para selecionar o arquivo'}
            </span>
            <span className="text-xs text-muted-foreground">
              Formato aceito: .csv — até{' '}
              {LIMITE_IMPORTACAO.toLocaleString('pt-BR')} contatos
            </span>
            <Input
              id="import-file"
              ref={entrada}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={lerArquivo}
            />
          </label>

          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            <FileSpreadsheet className="size-4 shrink-0 text-primary" />
            As colunas devem seguir a ordem: Nome, Número, Etiqueta.
          </div>

          {(erroLeitura || estado.erro) && (
            <p role="alert" className="text-sm text-destructive">
              {erroLeitura || estado.erro}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <BotaoImportar pronto={conteudo.length > 0} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
