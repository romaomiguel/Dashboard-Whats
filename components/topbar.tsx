import Link from 'next/link'
import { Send } from 'lucide-react'
import { MenuConta } from '@/components/menu-conta'
import { SinoNotificacoes } from '@/components/sino-notificacoes'
import { ThemeToggle } from '@/components/theme-toggle'
import { TituloPagina } from '@/components/titulo-pagina'
import { Button } from '@/components/ui/button'
import type { Notificacao } from '@/lib/notificacoes'

export function Topbar({
  nome,
  email,
  ownerId,
  notificacoes,
}: {
  nome: string
  email: string
  ownerId: string
  notificacoes: Notificacao[]
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border bg-background/80 px-6 py-4 backdrop-blur md:flex-row md:items-center md:justify-between">
      <TituloPagina />

      <div className="flex items-center gap-2">
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

        <SinoNotificacoes iniciais={notificacoes} ownerId={ownerId} />

        <ThemeToggle />

        <MenuConta nome={nome} email={email} />
      </div>
    </header>
  )
}
