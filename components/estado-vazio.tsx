import type { LucideIcon } from 'lucide-react'

export function EstadoVazio({
  titulo,
  descricao,
  icone: Icone,
}: {
  titulo: string
  descricao: string
  icone: LucideIcon
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icone className="size-5" />
      </div>
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{descricao}</p>
    </div>
  )
}
