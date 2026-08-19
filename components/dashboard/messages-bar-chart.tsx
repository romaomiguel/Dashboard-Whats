'use client'

import { BarChart3 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { useDadosExemplo } from '@/components/dados-exemplo-provider'
import { EstadoVazio } from '@/components/estado-vazio'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { weeklyMessages } from '@/lib/data'

const chartConfig = {
  enviadas: {
    label: 'Enviadas',
    color: 'var(--chart-1)',
  },
  recebidas: {
    label: 'Recebidas',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

export function MessagesBarChart() {
  const { mostrarExemplo } = useDadosExemplo()

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Volume de mensagens</CardTitle>
          <p className="text-sm text-muted-foreground">Últimos 7 dias</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-1" /> Enviadas
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-2" /> Recebidas
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {mostrarExemplo ? (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <BarChart data={weeklyMessages} barGap={6}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="dia"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={40}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="enviadas"
                fill="var(--color-enviadas)"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="recebidas"
                fill="var(--color-recebidas)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <EstadoVazio
            icone={BarChart3}
            titulo="Sem mensagens ainda"
            descricao="Conecte seu WhatsApp em Conexão para começar a registrar o volume diário."
          />
        )}
      </CardContent>
    </Card>
  )
}
