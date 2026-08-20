import Link from 'next/link'
import { Bell, Search, Send } from 'lucide-react'
import { sair } from '@/app/login/actions'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ThemeToggle } from '@/components/theme-toggle'
import { TituloPagina } from '@/components/titulo-pagina'

export function Topbar({ email }: { email: string }) {
  return (
    <header className="flex flex-col gap-4 border-b border-border bg-background/80 px-6 py-4 backdrop-blur md:flex-row md:items-center md:justify-between">
      <TituloPagina />

      <div className="flex items-center gap-2">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar contato ou número..."
            className="w-64 pl-9"
            aria-label="Buscar"
          />
        </div>

        {/* nativeButton={false}: o Base UI só dispensa o <button> nativo
            quando avisado, e aqui o render é um <a> do Next. */}
        <Button
          render={<Link href="/disparos" />}
          nativeButton={false}
          className="gap-2"
        >
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

        <form action={sair} className="flex items-center gap-2 pl-1">
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary/15 text-sm font-medium text-primary">
              {email.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="hidden leading-tight lg:block">
            <p className="max-w-40 truncate text-sm font-medium text-foreground">
              {email}
            </p>
            <button
              type="submit"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Sair
            </button>
          </div>
        </form>
      </div>
    </header>
  )
}
