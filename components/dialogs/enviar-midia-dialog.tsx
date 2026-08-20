'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CloudUpload, Loader2, Upload, X } from 'lucide-react'
import { registrarMidia } from '@/app/(app)/midias/actions'
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
  BUCKET_MIDIAS,
  caminhoNoBucket,
  formatarTamanho,
  LIMITE_TAMANHO,
  tipoDoArquivo,
} from '@/lib/midias'
import { criarClienteNavegador } from '@/lib/supabase/client'

export function EnviarMidiaDialog() {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [legenda, setLegenda] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!aberto) {
      setArquivo(null)
      setLegenda('')
      setErro('')
    }
  }, [aberto])

  function escolher(evento: React.ChangeEvent<HTMLInputElement>) {
    setErro('')
    const escolhido = evento.target.files?.[0] ?? null

    if (escolhido && escolhido.size > LIMITE_TAMANHO) {
      setErro(
        `O arquivo tem ${formatarTamanho(escolhido.size)} e o limite é 16 MB.`,
      )
      setArquivo(null)
      return
    }

    setArquivo(escolhido)
  }

  async function enviar() {
    if (!arquivo) return
    setErro('')
    setEnviando(true)

    try {
      const supabase = criarClienteNavegador()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setErro('Sessão expirada. Entre novamente.')
        return
      }

      // O arquivo vai do navegador direto para o Storage: passar por uma
      // server action esbarraria no limite de corpo dela bem antes dos 16 MB.
      const caminho = caminhoNoBucket(user.id, arquivo.name)
      const { error: erroUpload } = await supabase.storage
        .from(BUCKET_MIDIAS)
        .upload(caminho, arquivo, { contentType: arquivo.type || undefined })

      if (erroUpload) {
        setErro(
          /bucket/i.test(erroUpload.message)
            ? 'O bucket de mídias ainda não existe. Rode a migration 0004 no Supabase.'
            : 'Não foi possível enviar o arquivo. Tente de novo.',
        )
        return
      }

      const dados = new FormData()
      dados.set('nome', arquivo.name)
      dados.set('tipo', tipoDoArquivo(arquivo.type))
      dados.set('tamanho', String(arquivo.size))
      dados.set('caminho', caminho)
      dados.set('legenda', legenda)

      const resultado = await registrarMidia({}, dados)

      if (resultado.erro) {
        setErro(resultado.erro)
        return
      }

      setAberto(false)
      router.refresh()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
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
              {arquivo ? arquivo.name : 'Clique para selecionar o arquivo'}
            </span>
            <span className="text-xs text-muted-foreground">
              {arquivo
                ? formatarTamanho(arquivo.size)
                : 'Imagens, vídeos, áudios ou documentos até 16 MB'}
            </span>
            <Input
              id="midia-file"
              type="file"
              className="hidden"
              onChange={escolher}
            />
          </label>

          {arquivo && (
            <button
              type="button"
              onClick={() => setArquivo(null)}
              className="flex items-center gap-1.5 self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              <X className="size-3.5" />
              Escolher outro arquivo
            </button>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="midia-legenda">Legenda (opcional)</Label>
            <Textarea
              id="midia-legenda"
              rows={3}
              placeholder="Adicione uma legenda para a mídia..."
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
            />
          </div>

          {erro && (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            type="button"
            className="gap-2"
            onClick={enviar}
            disabled={!arquivo || enviando}
          >
            {enviando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {enviando ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
