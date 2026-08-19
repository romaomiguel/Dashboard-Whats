import {
  ArrowDownRight,
  ArrowUpRight,
  Contact,
  MessageCircle,
  Send,
  Wifi,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { summary } from '@/lib/data'
import { cn } from '@/lib/utils'

type Stat = {
  label: string
  value: string
  hint: string
  delta: string
  up: boolean
  icon: typeof Contact
}

const stats: Stat[] = [
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

export function StatCards() {
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
