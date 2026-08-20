'use client'

import { useState, useTransition } from 'react'
import { FileText, Film, ImageIcon, Music, Trash2 } from 'lucide-react'
import { useDadosExemplo } from '@/components/dados-exemplo-provider'
import { EnviarMidiaDialog } from '@/components/dialogs/enviar-midia-dialog'
import { EstadoVazio } from '@/components/estado-vazio'
import { SeloDadosExemplo } from '@/components/selo-dados-exemplo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { MidiaSalva } from '@/lib/consultas/midias'
import { midias as midiasExemplo } from '@/lib/data'
import { formatarData } from '@/lib/datas'
import { formatarTamanho, ROTULO_TIPO, type TipoMidia } from '@/lib/midias'
import { excluirMidia } from './actions'

const iconeTipo: Record<TipoMidia, typeof ImageIcon> = {
  imagem: ImageIcon,
  video: Film,
  documento: FileText,
  audio: Music,
}

/** Cartão da grade, venha ele do banco ou dos dados de exemplo. */
type Cartao = {
  id: string
  nome: string
  tipo: TipoMidia
  tamanho: string
  data: string
  ehExemplo: boolean
}

export function ListaMidias({ midias }: { midias: MidiaSalva[] }) {
  const { mostrarExemplo } = useDadosExemplo()
  const [excluindo, iniciarExclusao] = useTransition()
  const [erro, setErro] = useState('')

  // Só cai no exemplo quem ainda não enviou nada: o primeiro arquivo real
  // toma a tela por inteiro.
  const usandoExemplo = midias.length === 0 && mostrarExemplo

  const lista: Cartao[] = usandoExemplo
    ? midiasExemplo.map((m) => ({
        id: m.nome,
        nome: m.nome,
        tipo: m.tipo,
        tamanho: m.tamanho,
        data: m.data,
        ehExemplo: true,
      }))
    : midias.map((m) => ({
        id: m.id,
        nome: m.nome,
        tipo: m.tipo,
        tamanho: formatarTamanho(m.tamanho),
        data: formatarData(m.criadoEm),
        ehExemplo: false,
      }))

  function excluir(id: string) {
    setErro('')
    iniciarExclusao(async () => {
      const resultado = await excluirMidia(id)
      if (resultado.erro) setErro(resultado.erro)
    })
  }

  return (
    <>
      <SeloDadosExemplo />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {lista.length}{' '}
          {usandoExemplo
            ? 'arquivos de exemplo na biblioteca'
            : 'arquivos na biblioteca de mídias'}
        </p>
        <EnviarMidiaDialog />
      </div>

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

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
              <Card key={m.id} className="group relative overflow-hidden">
                <div className="flex aspect-video items-center justify-center bg-muted">
                  <Icone className="size-10 text-muted-foreground" />
                </div>

                {!m.ehExemplo && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 size-8 bg-background/80 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                    disabled={excluindo}
                    onClick={() => excluir(m.id)}
                    aria-label={`Excluir ${m.nome}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}

                <CardContent className="flex flex-col gap-1 p-4">
                  <p
                    className="truncate text-sm font-medium text-foreground"
                    title={m.nome}
                  >
                    {m.nome}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{ROTULO_TIPO[m.tipo]}</span>
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
