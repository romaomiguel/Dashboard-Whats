'use client'

import {
  Contact,
  Home,
  Image as ImageIcon,
  MessageCircle,
  Send,
  Settings,
  Link2,
  MessageSquareText,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { summary } from '@/lib/data'

type NavItem = {
  id: string
  label: string
  icon: typeof Home
  count?: number
}

const mainNav: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'conexao', label: 'Conexão', icon: Link2 },
  { id: 'contatos', label: 'Contatos', icon: Contact, count: summary.contatos },
  { id: 'mensagens', label: 'Mensagens', icon: MessageCircle, count: summary.mensagens },
  { id: 'midias', label: 'Mídias', icon: ImageIcon },
]

const secondaryNav: NavItem[] = [
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
  { id: 'disparos', label: 'Disparos', icon: Send },
]

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`
  return String(n)
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem
  active: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="flex-1 text-left">{item.label}</span>
      {typeof item.count === 'number' && (
        <Badge
          variant="secondary"
          className={cn(
            'min-w-6 justify-center rounded-full px-1.5 font-mono text-[11px] tabular-nums',
            active
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {formatCount(item.count)}
        </Badge>
      )}
    </button>
  )
}

export function Sidebar() {
  const [active, setActive] = useState('home')

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
        {mainNav.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={active === item.id}
            onClick={() => setActive(item.id)}
          />
        ))}

        <div className="my-4 h-px bg-sidebar-border" />

        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sistema
        </p>
        {secondaryNav.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={active === item.id}
            onClick={() => setActive(item.id)}
          />
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/60 px-3 py-2.5">
          <span className="flex size-2 items-center justify-center">
            <span className="size-2 animate-pulse rounded-full bg-primary" />
          </span>
          <p className="text-xs text-muted-foreground">
            {summary.conexoesAtivas} de {summary.conexoesTotal} conexões online
          </p>
        </div>
      </div>
    </aside>
  )
}
