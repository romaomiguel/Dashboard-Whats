'use client'

import { Bell, Search, Send } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/theme-toggle'

export function Topbar() {
  return (
    <header className="flex flex-col gap-4 border-b border-border bg-background/80 px-6 py-4 backdrop-blur md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitoramento de WhatsApp em tempo real
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar contato ou número..."
            className="w-64 pl-9"
            aria-label="Buscar"
          />
        </div>

        <Button className="gap-2">
          <Send className="size-4" />
          <span className="hidden sm:inline">Novo disparo</span>
        </Button>

        <Button
          variant="outline"
          size="icon"
          aria-label="Notificações"
          className="relative rounded-full"
        >
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-primary" />
        </Button>

        <ThemeToggle />

        <div className="flex items-center gap-2 pl-1">
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary/15 text-sm font-medium text-primary">
              LW
            </AvatarFallback>
          </Avatar>
          <div className="hidden leading-tight lg:block">
            <p className="text-sm font-medium text-foreground">Leslie Watson</p>
            <p className="text-xs text-muted-foreground">Admin</p>
          </div>
        </div>
      </div>
    </header>
  )
}
