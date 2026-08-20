'use client'

import { Send } from 'lucide-react'
import { useDadosExemplo } from '@/components/dados-exemplo-provider'
import { NovoDisparoDialog } from '@/components/dialogs/novo-disparo-dialog'
import { EstadoVazio } from '@/components/estado-vazio'
import { SeloDadosExemplo } from '@/components/selo-dados-exemplo'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { disparos, type Disparo } from '@/lib/data'
import type { Etiqueta } from '@/lib/etiquetas'

const estiloStatus: Record<Disparo['status'], string> = {
  enviando: 'bg-primary/15 text-primary',
  agendado: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  concluido: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  rascunho: 'bg-muted text-muted-foreground',
}

const rotuloStatus: Record<Disparo['status'], string> = {
  enviando: 'Enviando',
  agendado: 'Agendado',
  concluido: 'Concluído',
  rascunho: 'Rascunho',
}

export function ListaDisparos({ etiquetas }: { etiquetas: Etiqueta[] }) {
  const { mostrarExemplo } = useDadosExemplo()
  const lista = mostrarExemplo ? disparos : []

  return (
    <>
      <SeloDadosExemplo />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {lista.length} campanhas de disparo
        </p>
        <NovoDisparoDialog etiquetas={etiquetas} />
      </div>

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
            const progresso = d.total > 0 ? Math.round((d.entregues * 100) / d.total) : 0
            return (
              <Card key={d.nome}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Send className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{d.nome}</CardTitle>
                      <p className="text-xs text-muted-foreground">{d.data}</p>
                    </div>
                  </div>
                  <Badge className={estiloStatus[d.status]}>
                    {rotuloStatus[d.status]}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {d.entregues.toLocaleString('pt-BR')} de{' '}
                      {d.total.toLocaleString('pt-BR')} entregues
                    </span>
                    <span className="font-medium text-foreground">{progresso}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progresso}%` }}
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
