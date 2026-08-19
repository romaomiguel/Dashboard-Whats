import { Check, CheckCheck } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { mensagensRecentes, type Mensagem } from '@/lib/data'
import { cn } from '@/lib/utils'

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

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

export function RecentMessages() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Mensagens recentes</CardTitle>
          <p className="text-sm text-muted-foreground">Conversas ativas</p>
        </div>
        <Badge variant="secondary" className="rounded-full">
          {mensagensRecentes.length} conversas
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border">
        {mensagensRecentes.map((m) => (
          <div key={m.numero} className="flex items-center gap-3 py-3 first:pt-0">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary/12 text-xs font-medium text-primary">
                {initials(m.contato)}
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
        ))}
      </CardContent>
    </Card>
  )
}
