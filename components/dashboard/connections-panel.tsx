'use client'

import { BatteryFull, BatteryLow, Smartphone } from 'lucide-react'
import { useDadosExemplo } from '@/components/dados-exemplo-provider'
import { EstadoVazio } from '@/components/estado-vazio'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Conexao as ConexaoReal } from '@/lib/conexoes'
import { ROTULO_STATUS } from '@/lib/conexoes'
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

type Linha = {
  chave: string
  nome: string
  numero: string
  status: Conexao['status']
  bateria: number | null
}

export function ConnectionsPanel({ conexoes: reais }: { conexoes: ConexaoReal[] }) {
  const { mostrarExemplo } = useDadosExemplo()

  const temReais = reais.length > 0
  const lista: Linha[] = temReais
    ? reais.map((c) => ({
        chave: c.id,
        nome: c.nome,
        // Bateria só existiria com o aparelho reportando; não inventar.
        numero: c.numero ?? ROTULO_STATUS[c.status],
        status:
          c.status === 'conectada'
            ? 'online'
            : c.status === 'desconectada'
              ? 'offline'
              : 'conectando',
        bateria: null,
      }))
    : conexoes.map((c) => ({
        chave: c.numero,
        nome: c.nome,
        numero: c.numero,
        status: c.status,
        bateria: c.bateria,
      }))
  const mostrar = temReais || mostrarExemplo

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Conexões</CardTitle>
        <p className="text-sm text-muted-foreground">Sessões de WhatsApp</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {mostrar ? (
          lista.map((c) => (
            <div
              key={c.chave}
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
                {c.status !== 'offline' && c.bateria !== null && (
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
          ))
        ) : (
          <EstadoVazio
            icone={Smartphone}
            titulo="Nenhuma conexão"
            descricao="Vá em Conexão e leia o QR code para conectar seu WhatsApp."
          />
        )}
      </CardContent>
    </Card>
  )
}
