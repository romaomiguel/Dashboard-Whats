'use client'

import {
  Contact,
  Home,
  Image as ImageIcon,
  Link2,
  MessageCircle,
  MessageSquareText,
  Send,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export type ItemNav = {
  href: string
  label: string
  icon: LucideIcon
  secao: 'principal' | 'sistema'
}

export const ITENS_NAV: ItemNav[] = [
  { href: '/', label: 'Home', icon: Home, secao: 'principal' },
  { href: '/conexao', label: 'Conexão', icon: Link2, secao: 'principal' },
  { href: '/contatos', label: 'Contatos', icon: Contact, secao: 'principal' },
  { href: '/mensagens', label: 'Mensagens', icon: MessageCircle, secao: 'principal' },
  { href: '/midias', label: 'Mídias', icon: ImageIcon, secao: 'principal' },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, secao: 'sistema' },
  { href: '/disparos', label: 'Disparos', icon: Send, secao: 'sistema' },
]

function LinkNav({ item, ativo }: { item: ItemNav; ativo: boolean }) {
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
    </Link>
  )
}

export function Sidebar() {
  const caminho = usePathname()

  // Comparação exata: startsWith deixaria a Home sempre ativa.
  const ehAtivo = (href: string) =>
    href === '/' ? caminho === '/' : caminho === href || caminho.startsWith(`${href}/`)

  const principais = ITENS_NAV.filter((i) => i.secao === 'principal')
  const sistema = ITENS_NAV.filter((i) => i.secao === 'sistema')

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
          <LinkNav key={item.href} item={item} ativo={ehAtivo(item.href)} />
        ))}

        <div className="my-4 h-px bg-sidebar-border" />

        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sistema
        </p>
        {sistema.map((item) => (
          <LinkNav key={item.href} item={item} ativo={ehAtivo(item.href)} />
        ))}
      </nav>
    </aside>
  )
}
