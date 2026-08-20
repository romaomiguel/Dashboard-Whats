'use client'

import { QrCode, RefreshCw, Signal, Smartphone } from 'lucide-react'
import { useDadosExemplo } from '@/components/dados-exemplo-provider'
import { NovaConexaoDialog } from '@/components/dialogs/nova-conexao-dialog'
import { EstadoVazio } from '@/components/estado-vazio'
import { SeloDadosExemplo } from '@/components/selo-dados-exemplo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { conexoes, summary, type Conexao } from '@/lib/data'

const estiloStatus: Record<Conexao['status'], string> = {
  online: 'bg-primary/15 text-primary',
  conectando: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  offline: 'bg-muted text-muted-foreground',
}

const rotuloStatus: Record<Conexao['status'], string> = {
  online: 'Online',
  conectando: 'Conectando',
  offline: 'Offline',
}

export default function Page() {
  const { mostrarExemplo } = useDadosExemplo()
  const lista = mostrarExemplo ? conexoes : []
  const ativas = mostrarExemplo ? summary.conexoesAtivas : 0
  const total = mostrarExemplo ? summary.conexoesTotal : 0

  return (
    <>
      <SeloDadosExemplo />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Signal className="size-4 text-primary" />
          {ativas} de {total} instâncias online
        </div>
        <NovaConexaoDialog />
      </div>

      {lista.length === 0 ? (
        <Card>
          <EstadoVazio
            icone={Smartphone}
            titulo="Nenhuma conexão"
            descricao="Crie uma instância e leia o QR code no WhatsApp para conectar."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {lista.map((c) => (
            <Card key={c.numero}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{c.nome}</CardTitle>
                <Badge className={estiloStatus[c.status]}>
                  {rotuloStatus[c.status]}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="font-mono text-sm text-muted-foreground">{c.numero}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Bateria</span>
                  <span className="font-medium text-foreground">{c.bateria}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${c.bateria}%` }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-2">
                    <QrCode className="size-4" />
                    QR Code
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 gap-2">
                    <RefreshCw className="size-4" />
                    Reconectar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
