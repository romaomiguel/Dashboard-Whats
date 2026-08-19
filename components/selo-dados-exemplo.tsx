'use client'

import { FlaskConical } from 'lucide-react'
import { useDadosExemplo } from '@/components/dados-exemplo-provider'

export function SeloDadosExemplo() {
  const { mostrarExemplo, alternar, pronto } = useDadosExemplo()

  if (!pronto) return null

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
      <FlaskConical className="size-4 shrink-0 text-muted-foreground" />
      <p className="flex-1 text-muted-foreground">
        {mostrarExemplo
          ? 'Dados de exemplo'
          : 'Mostrando dados reais — conecte seu WhatsApp para preencher'}
      </p>
      <button
        type="button"
        onClick={alternar}
        className="shrink-0 font-medium text-primary underline-offset-2 hover:underline"
      >
        {mostrarExemplo ? 'Zerar' : 'Restaurar exemplo'}
      </button>
    </div>
  )
}
