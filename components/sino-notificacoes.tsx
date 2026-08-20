'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, MessageCircle, Send, Wifi } from 'lucide-react'
import {
  marcarComoLida,
  marcarTodasComoLidas,
} from '@/app/(app)/notificacoes/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatarDataHora } from '@/lib/datas'
import type { Notificacao, TipoNotificacao } from '@/lib/notificacoes'
import { criarClienteNavegador } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const ICONE: Record<TipoNotificacao, typeof Bell> = {
  mensagem: MessageCircle,
  disparo: Send,
  conexao: Wifi,
}

/** Acima disso o número deforma o sino. */
const TETO_CONTADOR = 9

export function SinoNotificacoes({
  iniciais,
  ownerId,
}: {
  iniciais: Notificacao[]
  ownerId: string
}) {
  const router = useRouter()

  // A lista do servidor é a verdade; o local guarda só quais foram lidas
  // agora, para o item riscar na hora sem esperar a ação voltar.
  //
  // Derivar em vez de copiar com useEffect é proposital: `iniciais` chega como
  // array novo a cada render, e sincronizar por efeito entraria em laço.
  const [lidasAgora, setLidasAgora] = useState<string[]>([])

  const lista = iniciais.map((n) =>
    lidasAgora.includes(n.id) ? { ...n, lida: true } : n,
  )

  // Realtime: o canal entrega a linha nova sem recarregar. Caindo, a lista
  // inicial continua correta e se atualiza na próxima navegação.
  useEffect(() => {
    const supabase = criarClienteNavegador()

    const canal = supabase
      .channel(`notificacoes:${ownerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificacoes',
          filter: `owner_id=eq.${ownerId}`,
        },
        () => router.refresh(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [ownerId, router])

  const naoLidas = lista.filter((n) => !n.lida).length

  async function abrir(notificacao: Notificacao) {
    setLidasAgora((atual) => [...atual, notificacao.id])
    await marcarComoLida(notificacao.id)
    if (notificacao.destino) router.push(notificacao.destino)
  }

  async function lerTodas() {
    setLidasAgora(iniciais.map((n) => n.id))
    await marcarTodasComoLidas()
  }

  return (
    <DropdownMenu>
      {/* Sem render de Button: o gatilho já renderiza um <button>, e passar
          outro pelo render foi o que gerou aviso do Base UI no menu da conta. */}
      <DropdownMenuTrigger
        aria-label={`Notificações${naoLidas > 0 ? `, ${naoLidas} não lidas` : ''}`}
        className="relative flex size-8 items-center justify-center rounded-full border border-border bg-background outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="size-4" />
        {naoLidas > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {naoLidas > TETO_CONTADOR ? `${TETO_CONTADOR}+` : naoLidas}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium text-foreground">Notificações</span>
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="gap-1.5 text-xs"
              onClick={lerTodas}
            >
              <CheckCheck className="size-3.5" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {lista.length === 0 ? (
          <p className="px-3 pb-4 pt-2 text-center text-sm text-muted-foreground">
            Nenhuma notificação por aqui. Mensagem recebida, campanha concluída e
            queda de conexão aparecem neste painel.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto border-t border-border">
            {lista.map((n) => {
              const Icone = ICONE[n.tipo]
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => abrir(n)}
                    className={cn(
                      'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60',
                      !n.lida && 'bg-primary/5',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg',
                        n.lida
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary/15 text-primary',
                      )}
                    >
                      <Icone className="size-3.5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {n.titulo}
                        </span>
                        {!n.lida && (
                          <Badge className="size-1.5 shrink-0 rounded-full bg-primary p-0" />
                        )}
                      </span>
                      {n.corpo && (
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {n.corpo}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {formatarDataHora(n.quando)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
