'use client'

import { PolarGrid, RadialBar, RadialBarChart } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { deliveryScale, summary } from '@/lib/data'

const chartConfig = {
  valor: { label: 'Taxa' },
  entregues: { label: 'Entregues', color: 'var(--chart-1)' },
  lidas: { label: 'Lidas', color: 'var(--chart-2)' },
  respondidas: { label: 'Respondidas', color: 'var(--chart-3)' },
} satisfies ChartConfig

export function DeliveryScaleChart() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Escala de desempenho</CardTitle>
        <p className="text-sm text-muted-foreground">
          Funil de entrega dos disparos
        </p>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square h-[220px]"
        >
          <RadialBarChart
            data={deliveryScale}
            innerRadius={40}
            outerRadius={110}
            startAngle={90}
            endAngle={-270}
          >
            <PolarGrid gridType="circle" radialLines={false} stroke="none" />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent nameKey="etapa" />}
            />
            <RadialBar dataKey="valor" background cornerRadius={8} />
          </RadialBarChart>
        </ChartContainer>

        <div className="mt-2 grid w-full grid-cols-3 gap-2 text-center">
          {deliveryScale.map((item, i) => (
            <div key={item.etapa} className="rounded-lg bg-muted/60 py-2">
              <p
                className="font-mono text-lg font-semibold tabular-nums"
                style={{ color: `var(--chart-${i + 1})` }}
              >
                {item.valor}%
              </p>
              <p className="text-xs text-muted-foreground">{item.etapa}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Taxa média de entrega de{' '}
          <span className="font-medium text-foreground">
            {summary.taxaEntrega}%
          </span>{' '}
          nas últimas campanhas
        </p>
      </CardContent>
    </Card>
  )
}
