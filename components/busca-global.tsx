'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

/**
 * Busca da topbar. Manda o termo para a tela de Contatos, que já sabe filtrar
 * pela query `busca` — em vez de um campo decorativo que não leva a lugar
 * nenhum.
 */
export function BuscaGlobal() {
  const router = useRouter()
  const [termo, setTermo] = useState('')

  function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    const limpo = termo.trim()
    router.push(limpo ? `/contatos?busca=${encodeURIComponent(limpo)}` : '/contatos')
  }

  return (
    <form onSubmit={enviar} role="search" className="relative hidden sm:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Buscar contato ou número..."
        className="w-64 pl-9"
        aria-label="Buscar contato ou número"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
      />
    </form>
  )
}
