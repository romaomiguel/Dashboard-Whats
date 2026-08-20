'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Loader2, Send, Users, Zap } from 'lucide-react'
import { useDadosExemplo } from '@/components/dados-exemplo-provider'
import { NovoDisparoDialog } from '@/components/dialogs/novo-disparo-dialog'
import { EstadoVazio } from '@/components/estado-vazio'
import { SeloDadosExemplo } from '@/components/selo-dados-exemplo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Conexao } from '@/lib/conexoes'
import { disparos as disparosExemplo } from '@/lib/data'
import {
  ESTILO_DISPARO,
  progresso,
  ROTULO_DISPARO,
  type Disparo,
  type StatusDisparo,
} from '@/lib/disparos'
import { formatarDataHora } from '@/lib/datas'
import type { Etiqueta } from '@/lib/etiquetas'
import { cancelarDisparo, enviarAgora } from './actions'

/** Cartão da lista, venha ele do banco ou dos dados de exemplo. */
type Cartao = {
  id: string
  nome: string
  status: StatusDisparo
  total: number
  enviados: number
  falhas: number
  quando: string
  detalhe: string | null
  ehExemplo: boolean
}

const STATUS_EXEMPLO: Record<string, StatusDisparo> = {
  enviando: 'enviando',
  agendado: 'agendado',
  concluido: 'concluido',
  rascunho: 'cancelado',
}

export function ListaDisparos({
  etiquetas,
  conexoes,
  disparos,
}: {
  etiquetas: Etiqueta[]
  conexoes: Conexao[]
  disparos: Disparo[]
}) {
  const router = useRouter()
  const { mostrarExemplo } = useDadosExemplo()
  const [cancelando, iniciarCancelamento] = useTransition()
  const [enviando, iniciarEnvio] = useTransition()
  const [erro, setErro] = useState('')

  // Só cai no exemplo quem ainda não criou campanha nenhuma.
  const usandoExemplo = disparos.length === 0 && mostrarExemplo

  const lista: Cartao[] = usandoExemplo
    ? disparosExemplo.map((d) => ({
        id: d.nome,
        nome: d.nome,
        status: STATUS_EXEMPLO[d.status] ?? 'agendado',
        total: d.total,
        enviados: d.entregues,
        falhas: 0,
        quando: d.data,
        detalhe: null,
        ehExemplo: true,
      }))
    : disparos.map((d) => ({
        id: d.id,
        nome: d.nome,
        status: d.status,
        total: d.total,
        enviados: d.enviados,
        falhas: d.falhas,
        quando: formatarDataHora(d.agendadoPara),
        detalhe: [d.conexao, d.publico].filter(Boolean).join(' · '),
        ehExemplo: false,
      }))

  function enviar(id: string) {
    setErro('')
    iniciarEnvio(async () => {
      const resultado = await enviarAgora(id)
      if (resultado.erro) setErro(resultado.erro)
      else router.refresh()
    })
  }

  function cancelar(id: string) {
    setErro('')
    iniciarCancelamento(async () => {
      const resultado = await cancelarDisparo(id)
      if (resultado.erro) setErro(resultado.erro)
      else router.refresh()
    })
  }

  return (
    <>
      <SeloDadosExemplo />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {lista.length}{' '}
          {usandoExemplo
            ? 'campanhas de exemplo'
            : lista.length === 1
              ? 'campanha de disparo'
              : 'campanhas de disparo'}
        </p>
        <NovoDisparoDialog etiquetas={etiquetas} conexoes={conexoes} />
      </div>

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      {lista.length === 0 ? (
        <Card>
          <EstadoVazio
            icone={Send}
            titulo="Nenhuma campanha"
            descricao="Crie um disparo para enviar uma mensagem a vários contatos de uma vez."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {lista.map((d) => {
            const pct = progresso(d.enviados, d.total)
            const podeCancelar =
              !d.ehExemplo && (d.status === 'agendado' || d.status === 'enviando')

            return (
              <Card key={d.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Send className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{d.nome}</CardTitle>
                      <p className="truncate text-xs text-muted-foreground">
                        {d.quando}
                        {d.detalhe ? ` · ${d.detalhe}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {podeCancelar && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={enviando}
                        onClick={() => enviar(d.id)}
                        aria-label={`Enviar ${d.nome} agora`}
                      >
                        {enviando ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Zap className="size-4" />
                        )}
                        Enviar agora
                      </Button>
                    )}
                    {podeCancelar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-2 text-muted-foreground hover:text-destructive"
                        disabled={cancelando}
                        onClick={() => cancelar(d.id)}
                        aria-label={`Cancelar ${d.nome}`}
                      >
                        <Ban className="size-4" />
                        Cancelar
                      </Button>
                    )}
                    <Badge className={ESTILO_DISPARO[d.status]}>
                      {ROTULO_DISPARO[d.status]}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="size-3.5" />
                      {d.enviados.toLocaleString('pt-BR')} de{' '}
                      {d.total.toLocaleString('pt-BR')} enviadas
                      {d.falhas > 0 && (
                        <span className="text-destructive">
                          · {d.falhas} falharam
                        </span>
                      )}
                    </span>
                    <span className="font-medium text-foreground">{pct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
