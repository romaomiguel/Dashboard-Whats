'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CloudUpload,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  Music,
  Upload,
  X,
} from 'lucide-react'
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
  ROTULO_TIPO,
  tipoDoArquivo,
  type TipoMidia,
} from '@/lib/midias'
import { criarClienteNavegador } from '@/lib/supabase/client'

const ICONE_TIPO: Record<TipoMidia, typeof ImageIcon> = {
  imagem: ImageIcon,
  video: Film,
  audio: Music,
  documento: FileText,
}

export function EnviarMidiaDialog() {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [legenda, setLegenda] = useState('')
  const [previa, setPrevia] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!aberto) {
      setArquivo(null)
      setLegenda('')
      setErro('')
    }
  }, [aberto])

  const tipo = arquivo ? tipoDoArquivo(arquivo.type) : 'documento'
  const IconeDoTipo = ICONE_TIPO[tipo]

  // createObjectURL aponta para o arquivo que já está na memória do
  // navegador: nada sobe para o Supabase nem passa pela Vercel, então a
  // prévia não consome cota nenhuma. Só precisa ser revogada, senão o blob
  // fica preso até a aba fechar.
  useEffect(() => {
    if (!arquivo || tipoDoArquivo(arquivo.type) !== 'imagem') {
      setPrevia('')
      return
    }

    const url = URL.createObjectURL(arquivo)
    setPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

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
          {/* Escolhido o arquivo, a área de seleção dá lugar à prévia: é um
              arquivo por vez, então oferecer "selecionar" de novo só confunde. */}
          {arquivo ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-center overflow-hidden rounded-md bg-muted">
                {previa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previa}
                    alt={`Prévia de ${arquivo.name}`}
                    className="max-h-48 w-full object-contain"
                  />
                ) : (
                  <div className="flex h-32 w-full items-center justify-center">
                    <IconeDoTipo className="size-10 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-medium text-foreground"
                    title={arquivo.name}
                  >
                    {arquivo.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ROTULO_TIPO[tipo]} · {formatarTamanho(arquivo.size)}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setArquivo(null)}
                  aria-label="Remover arquivo escolhido"
                >
                  <X className="size-4" />
                </Button>
              </div>

              <label
                htmlFor="midia-file"
                className="cursor-pointer self-start text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                Escolher outro arquivo
                <Input
                  id="midia-file"
                  type="file"
                  className="hidden"
                  onChange={escolher}
                />
              </label>
            </div>
          ) : (
            <label
              htmlFor="midia-file"
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-8 text-center transition-colors hover:bg-muted/70"
            >
              <CloudUpload className="size-8 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Clique para selecionar o arquivo
              </span>
              <span className="text-xs text-muted-foreground">
                Imagens, vídeos, áudios ou documentos até 16 MB
              </span>
              <Input
                id="midia-file"
                type="file"
                className="hidden"
                onChange={escolher}
              />
            </label>
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
