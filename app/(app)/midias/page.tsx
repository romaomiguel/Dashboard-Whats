'use client'

import { FileText, Film, ImageIcon, Music } from 'lucide-react'
import { useDadosExemplo } from '@/components/dados-exemplo-provider'
import { EnviarMidiaDialog } from '@/components/dialogs/enviar-midia-dialog'
import { EstadoVazio } from '@/components/estado-vazio'
import { SeloDadosExemplo } from '@/components/selo-dados-exemplo'
import { Card, CardContent } from '@/components/ui/card'
import { midias, type Midia } from '@/lib/data'

const iconeTipo: Record<Midia['tipo'], typeof ImageIcon> = {
  imagem: ImageIcon,
  video: Film,
  documento: FileText,
  audio: Music,
}

const rotuloTipo: Record<Midia['tipo'], string> = {
  imagem: 'Imagem',
  video: 'Vídeo',
  documento: 'Documento',
  audio: 'Áudio',
}

export default function Page() {
  const { mostrarExemplo } = useDadosExemplo()
  const lista = mostrarExemplo ? midias : []

  return (
    <>
      <SeloDadosExemplo />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {lista.length} arquivos na biblioteca de mídias
        </p>
        <EnviarMidiaDialog />
      </div>

      {lista.length === 0 ? (
        <Card>
          <EstadoVazio
            icone={ImageIcon}
            titulo="Biblioteca vazia"
            descricao="Envie imagens, vídeos, áudios ou documentos para reutilizar nos disparos."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {lista.map((m) => {
            const Icone = iconeTipo[m.tipo]
            return (
              <Card key={m.nome} className="overflow-hidden">
                <div className="flex aspect-video items-center justify-center bg-muted">
                  <Icone className="size-10 text-muted-foreground" />
                </div>
                <CardContent className="flex flex-col gap-1 p-4">
                  <p
                    className="truncate text-sm font-medium text-foreground"
                    title={m.nome}
                  >
                    {m.nome}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{rotuloTipo[m.tipo]}</span>
                    <span>{m.tamanho}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{m.data}</span>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
