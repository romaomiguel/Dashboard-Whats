'use client'

import { Check, CheckCheck, MessageCircle } from 'lucide-react'
import { useDadosExemplo } from '@/components/dados-exemplo-provider'
import { EstadoVazio } from '@/components/estado-vazio'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Conversa } from '@/lib/consultas/mensagens'
import { formatarHora } from '@/lib/datas'
import { mensagensRecentes, type Mensagem } from '@/lib/data'
import { iniciais } from '@/lib/iniciais'
import { cn } from '@/lib/utils'

function StatusIcon({ status }: { status: Mensagem['status'] }) {
  if (status === 'entregue')
    return <Check className="size-3.5 text-muted-foreground" />
  return (
    <CheckCheck
      className={cn(
        'size-3.5',
        status === 'lida' ? 'text-primary' : 'text-muted-foreground',
      )}
    />
  )
}

type Linha = {
  chave: string
  contato: string
  previa: string
  hora: string
  naoLidas: number
  status: Mensagem['status']
}

/** Conversa do banco no formato que este cartão já sabia desenhar. */
function daConversa(c: Conversa): Linha {
  return {
    chave: c.numero,
    contato: c.nome,
    previa: c.previa,
    hora: formatarHora(c.quando),
    naoLidas: c.naoLidas,
    status:
      c.direcao === 'entrada'
        ? 'respondida'
        : (c.status as string) === 'lida'
          ? 'lida'
          : 'entregue',

  }
}

export function RecentMessages({ conversas }: { conversas: Conversa[] }) {
  const { mostrarExemplo } = useDadosExemplo()

  const temReais = conversas.length > 0
  const lista: Linha[] = temReais
    ? conversas.slice(0, 5).map(daConversa)
    : mensagensRecentes.map((m) => ({
        chave: m.numero,
        contato: m.contato,
        previa: m.previa,
        hora: m.hora,
        naoLidas: m.naoLidas,
        status: m.status,
      }))
  const mostrar = temReais || mostrarExemplo

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Mensagens recentes</CardTitle>
          <p className="text-sm text-muted-foreground">Conversas ativas</p>
        </div>
        <Badge variant="secondary" className="rounded-full">
          {mostrar ? lista.length : 0} conversas
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {mostrar ? (
          lista.map((m) => (
            <div key={m.chave} className="flex items-center gap-3 py-3 first:pt-0">
              <Avatar className="size-10">
                <AvatarFallback className="bg-primary/12 text-xs font-medium text-primary">
                  {iniciais(m.contato)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {m.contato}
                  </p>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {m.hora}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusIcon status={m.status} />
                  <p className="truncate text-sm text-muted-foreground">
                    {m.previa}
                  </p>
                </div>
              </div>
              {m.naoLidas > 0 && (
                <Badge className="size-5 justify-center rounded-full p-0 font-mono text-[11px] tabular-nums">
                  {m.naoLidas}
                </Badge>
              )}
            </div>
          ))
        ) : (
          <EstadoVazio
            icone={MessageCircle}
            titulo="Nenhuma conversa"
            descricao="Conecte seu WhatsApp para ver suas conversas aqui."
          />
        )}
      </CardContent>
    </Card>
  )
}
