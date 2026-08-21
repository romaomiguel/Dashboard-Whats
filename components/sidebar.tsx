'use client'

import {
  Contact,
  Home,
  Image as ImageIcon,
  Kanban,
  Link2,
  MessageCircle,
  MessageSquareText,
  Send,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useDadosExemplo } from '@/components/dados-exemplo-provider'
import { Badge } from '@/components/ui/badge'
import { summary } from '@/lib/data'
import { cn } from '@/lib/utils'

export type ItemNav = {
  href: string
  label: string
  /** Linha de apoio mostrada na topbar quando a rota está ativa. */
  subtitulo: string
  icon: LucideIcon
  secao: 'principal' | 'sistema'
  /** Contador exibido como selo; só aparece com dados de exemplo ligados. */
  contador?: number
}

export const ITENS_NAV: ItemNav[] = [
  {
    href: '/',
    label: 'Home',
    subtitulo: 'Monitoramento de WhatsApp em tempo real',
    icon: Home,
    secao: 'principal',
  },
  {
    href: '/conexao',
    label: 'Conexão',
    subtitulo: 'Gerencie as instâncias de WhatsApp conectadas',
    icon: Link2,
    secao: 'principal',
  },
  {
    href: '/contatos',
    label: 'Contatos',
    subtitulo: 'Sua base de contatos e segmentação',
    icon: Contact,
    secao: 'principal',
    contador: summary.contatos,
  },
  {
    href: '/mensagens',
    label: 'Mensagens',
    subtitulo: 'Conversas e histórico de atendimento',
    icon: MessageCircle,
    secao: 'principal',
    contador: summary.mensagens,
  },
  {
    href: '/esteira',
    label: 'Esteira',
    subtitulo: 'Funil de etapas dos contatos',
    icon: Kanban,
    secao: 'principal',
  },
  {
    href: '/midias',
    label: 'Mídias',
    subtitulo: 'Biblioteca de imagens, vídeos e documentos',
    icon: ImageIcon,
    secao: 'principal',
  },
  {
    href: '/configuracoes',
    label: 'Configurações',
    subtitulo: 'Preferências da conta e do sistema',
    icon: Settings,
    secao: 'sistema',
  },
  {
    href: '/disparos',
    label: 'Disparos',
    subtitulo: 'Campanhas e envios em massa',
    icon: Send,
    secao: 'sistema',
  },
]

/** 4820 vira "4.8k"; abaixo de mil o número vai inteiro. */
export function formatarContador(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`
  return String(n)
}

function LinkNav({
  item,
  ativo,
  contador,
}: {
  item: ItemNav
  ativo: boolean
  contador?: number
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        ativo
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="flex-1 text-left">{item.label}</span>
      {typeof contador === 'number' && (
        <Badge
          variant="secondary"
          className={cn(
            'min-w-6 justify-center rounded-full px-1.5 font-mono text-[11px] tabular-nums',
            ativo
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {formatarContador(contador)}
        </Badge>
      )}
    </Link>
  )
}

export function Sidebar() {
  const caminho = usePathname()
  const { mostrarExemplo } = useDadosExemplo()

  // Comparação exata: startsWith deixaria a Home sempre ativa.
  const ehAtivo = (href: string) =>
    href === '/' ? caminho === '/' : caminho === href || caminho.startsWith(`${href}/`)

  const principais = ITENS_NAV.filter((i) => i.secao === 'principal')
  const sistema = ITENS_NAV.filter((i) => i.secao === 'sistema')

  const ativas = mostrarExemplo ? summary.conexoesAtivas : 0
  const total = mostrarExemplo ? summary.conexoesTotal : 0

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <MessageSquareText className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-sidebar-foreground">ZapCRM</p>
          <p className="text-xs text-muted-foreground">Painel WhatsApp</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        <p className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Menu principal
        </p>
        {principais.map((item) => (
          <LinkNav
            key={item.href}
            item={item}
            ativo={ehAtivo(item.href)}
            contador={mostrarExemplo ? item.contador : undefined}
          />
        ))}

        <div className="my-4 h-px bg-sidebar-border" />

        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sistema
        </p>
        {sistema.map((item) => (
          <LinkNav
            key={item.href}
            item={item}
            ativo={ehAtivo(item.href)}
            contador={mostrarExemplo ? item.contador : undefined}
          />
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/60 px-3 py-2.5">
          <span className="flex size-2 items-center justify-center">
            <span
              className={cn(
                'size-2 rounded-full',
                ativas > 0 ? 'animate-pulse bg-primary' : 'bg-muted-foreground/40',
              )}
            />
          </span>
          <p className="text-xs text-muted-foreground">
            {ativas} de {total} conexões online
          </p>
        </div>
      </div>
    </aside>
  )
}
