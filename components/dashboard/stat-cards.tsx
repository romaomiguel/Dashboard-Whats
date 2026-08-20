'use client'

import {
  ArrowDownRight,
  ArrowUpRight,
  Contact,
  MessageCircle,
  Send,
  Wifi,
} from 'lucide-react'
import { useDadosExemplo } from '@/components/dados-exemplo-provider'
import { Card } from '@/components/ui/card'
import type { Resumo } from '@/lib/consultas/resumo'
import { summary } from '@/lib/data'
import { cn } from '@/lib/utils'

type Stat = {
  label: string
  value: string
  hint: string
  delta: string | null
  up: boolean
  icon: typeof Contact
}

function statsExemplo(): Stat[] {
  return [
    {
      label: 'Contatos',
      value: summary.contatos.toLocaleString('pt-BR'),
      hint: 'total na base',
      delta: '+6,2%',
      up: true,
      icon: Contact,
    },
    {
      label: 'Mensagens hoje',
      value: '3.847',
      hint: `${summary.mensagens} não lidas`,
      delta: '+12,4%',
      up: true,
      icon: MessageCircle,
    },
    {
      label: 'Disparos hoje',
      value: summary.disparosHoje.toLocaleString('pt-BR'),
      hint: 'campanhas ativas',
      delta: '+3,1%',
      up: true,
      icon: Send,
    },
    {
      label: 'Conexões ativas',
      value: `${summary.conexoesAtivas}/${summary.conexoesTotal}`,
      hint: 'sessões WhatsApp',
      delta: '-1',
      up: false,
      icon: Wifi,
    },
  ]
}

function statsReais(resumo: Resumo): Stat[] {
  return [
    {
      label: 'Contatos',
      value: resumo.contatos.toLocaleString('pt-BR'),
      hint: 'total na base',
      delta: null,
      up: true,
      icon: Contact,
    },
    {
      label: 'Mensagens hoje',
      value: resumo.mensagensHoje.toLocaleString('pt-BR'),
      hint:
        resumo.naoLidas > 0
          ? `${resumo.naoLidas} recebidas`
          : 'nenhuma recebida',
      delta: null,
      up: true,
      icon: MessageCircle,
    },
    {
      label: 'Disparos hoje',
      value: resumo.disparosHoje.toLocaleString('pt-BR'),
      hint: 'mensagens enviadas',
      delta: null,
      up: true,
      icon: Send,
    },
    {
      label: 'Conexões ativas',
      value: `${resumo.conexoesAtivas}/${resumo.conexoesTotal}`,
      hint: 'sessões WhatsApp',
      delta: null,
      up: true,
      icon: Wifi,
    },
  ]
}

function statsVazios(): Stat[] {
  return [
    { label: 'Contatos', value: '0', hint: 'total na base', delta: null, up: true, icon: Contact },
    { label: 'Mensagens hoje', value: '0', hint: 'nenhuma não lida', delta: null, up: true, icon: MessageCircle },
    { label: 'Disparos hoje', value: '0', hint: 'nenhuma campanha', delta: null, up: true, icon: Send },
    { label: 'Conexões ativas', value: '0/0', hint: 'nenhuma sessão', delta: null, up: true, icon: Wifi },
  ]
}

export function StatCards({ resumo }: { resumo: Resumo }) {
  const { mostrarExemplo } = useDadosExemplo()

  // Dado real manda. Só quem ainda não tem nada gravado vê o exemplo.
  const stats = resumo.temDados
    ? statsReais(resumo)
    : mostrarExemplo
      ? statsExemplo()
      : statsVazios()

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <Icon className="size-5" />
              </div>
              {stat.delta && (
                <span
                  className={cn(
                    'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
                    stat.up
                      ? 'bg-primary/12 text-primary'
                      : 'bg-destructive/12 text-destructive',
                  )}
                >
                  {stat.up ? (
                    <ArrowUpRight className="size-3.5" />
                  ) : (
                    <ArrowDownRight className="size-3.5" />
                  )}
                  {stat.delta}
                </span>
              )}
            </div>
            <p className="mt-4 font-mono text-3xl font-semibold tracking-tight text-foreground tabular-nums">
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {stat.label} · <span className="text-foreground/70">{stat.hint}</span>
            </p>
          </Card>
        )
      })}
    </div>
  )
}
