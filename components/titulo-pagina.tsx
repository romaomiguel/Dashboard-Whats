'use client'

import { usePathname } from 'next/navigation'
import { ITENS_NAV } from '@/components/sidebar'

/** A Home aparece como "Dashboard"; as demais herdam o rótulo do menu. */
const TITULO_HOME = 'Dashboard'

export function TituloPagina() {
  const caminho = usePathname()

  const item =
    ITENS_NAV.find((i) =>
      i.href === '/' ? caminho === '/' : caminho.startsWith(i.href),
    ) ?? ITENS_NAV[0]

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {item.href === '/' ? TITULO_HOME : item.label}
      </h1>
      <p className="text-sm text-muted-foreground">{item.subtitulo}</p>
    </div>
  )
}
