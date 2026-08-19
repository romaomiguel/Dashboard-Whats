import { Construction } from 'lucide-react'
import { Card } from '@/components/ui/card'

export function TelaEmConstrucao({
  titulo,
  descricao,
  entrega,
}: {
  titulo: string
  descricao: string
  entrega: string
}) {
  return (
    <Card className="flex flex-col items-center gap-3 p-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Construction className="size-6" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        {titulo}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">{descricao}</p>
      <p className="font-mono text-xs text-muted-foreground">{entrega}</p>
    </Card>
  )
}
