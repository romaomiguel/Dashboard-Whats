'use client'

import { useMemo, useState } from 'react'
import { MessageCircle, Search } from 'lucide-react'
import { useDadosExemplo } from '@/components/dados-exemplo-provider'
import { EstadoVazio } from '@/components/estado-vazio'
import { SeloDadosExemplo } from '@/components/selo-dados-exemplo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { mensagensRecentes, summary, type Mensagem } from '@/lib/data'
import { iniciais } from '@/lib/iniciais'

const estiloStatus: Record<Mensagem['status'], string> = {
  respondida: 'bg-primary/15 text-primary',
  lida: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  entregue: 'bg-muted text-muted-foreground',
}

export function ListaConversas({ buscaInicial = '' }: { buscaInicial?: string }) {
  const { mostrarExemplo } = useDadosExemplo()
  const [busca, setBusca] = useState(buscaInicial)

  const lista = mostrarExemplo ? mensagensRecentes : []
  const ativas = mostrarExemplo ? summary.mensagens : 0

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return lista
    return lista.filter(
      (m) =>
        m.contato.toLowerCase().includes(termo) ||
        m.numero.includes(termo) ||
        m.previa.toLowerCase().includes(termo),
    )
  }, [lista, busca])

  return (
    <>
      <SeloDadosExemplo />

      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm">
        <MessageCircle className="size-4 text-primary" />
        <span className="font-medium text-foreground">{ativas}</span>
        <span className="text-muted-foreground">conversas ativas</span>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Conversas</CardTitle>
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              className="pl-9"
              aria-label="Buscar conversa"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtradas.length === 0 ? (
            <EstadoVazio
              icone={MessageCircle}
              titulo={busca ? 'Nada encontrado' : 'Nenhuma conversa'}
              descricao={
                busca
                  ? 'Nenhuma conversa corresponde à sua busca.'
                  : 'Conecte seu WhatsApp em Conexão para começar a receber mensagens.'
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {filtradas.map((m) => (
                <div
                  key={m.numero}
                  className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-muted/50"
                >
                  <div className="relative">
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary">
                        {iniciais(m.contato)}
                      </AvatarFallback>
                    </Avatar>
                    {m.naoLidas > 0 && (
                      <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                        {m.naoLidas}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {m.contato}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {m.hora}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{m.previa}</p>
                  </div>
                  <Badge className={estiloStatus[m.status]}>{m.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
