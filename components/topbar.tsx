import Link from 'next/link'
import { Bell, Send } from 'lucide-react'
import { BuscaGlobal } from '@/components/busca-global'
import { MenuConta } from '@/components/menu-conta'
import { ThemeToggle } from '@/components/theme-toggle'
import { TituloPagina } from '@/components/titulo-pagina'
import { Button } from '@/components/ui/button'

export function Topbar({ nome, email }: { nome: string; email: string }) {
  return (
    <header className="flex flex-col gap-4 border-b border-border bg-background/80 px-6 py-4 backdrop-blur md:flex-row md:items-center md:justify-between">
      <TituloPagina />

      <div className="flex items-center gap-2">
        <BuscaGlobal />

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

        {/* Ainda sem fonte de notificação: o painel chega na Entrega 2, junto
            com os eventos do webhook da Evolution. */}
        <Button
          variant="outline"
          size="icon"
          aria-label="Notificações (disponível na Entrega 2)"
          title="Notificações chegam na Entrega 2"
          disabled
          className="relative rounded-full"
        >
          <Bell className="size-4" />
        </Button>

        <ThemeToggle />

        <MenuConta nome={nome} email={email} />
      </div>
    </header>
  )
}
