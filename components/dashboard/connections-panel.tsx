import { BatteryFull, BatteryLow, Smartphone } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { conexoes, type Conexao } from '@/lib/data'
import { cn } from '@/lib/utils'

const statusLabel: Record<Conexao['status'], string> = {
  online: 'Online',
  offline: 'Offline',
  conectando: 'Conectando',
}

const statusDot: Record<Conexao['status'], string> = {
  online: 'bg-primary',
  offline: 'bg-muted-foreground/40',
  conectando: 'bg-amber-500',
}

export function ConnectionsPanel() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Conexões</CardTitle>
        <p className="text-sm text-muted-foreground">Sessões de WhatsApp</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {conexoes.map((c) => (
          <div
            key={c.numero}
            className="flex items-center gap-3 rounded-lg border border-border p-3"
          >
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Smartphone className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {c.nome}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {c.numero}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={cn(
                    'size-2 rounded-full',
                    statusDot[c.status],
                    c.status === 'conectando' && 'animate-pulse',
                  )}
                />
                {statusLabel[c.status]}
              </span>
              {c.status !== 'offline' && (
                <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground tabular-nums">
                  {c.bateria > 30 ? (
                    <BatteryFull className="size-3.5" />
                  ) : (
                    <BatteryLow className="size-3.5 text-destructive" />
                  )}
                  {c.bateria}%
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
