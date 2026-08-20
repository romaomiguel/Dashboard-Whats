'use client'

import { LogOut } from 'lucide-react'
import { sair } from '@/app/login/actions'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { iniciais } from '@/lib/iniciais'

export function MenuConta({ nome, email }: { nome: string; email: string }) {
  // Sem nome cadastrado, o e-mail é o que identifica a conta.
  const exibicao = nome || email
  const sigla = nome ? iniciais(nome) : email.slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Abrir menu da conta"
        className="flex items-center gap-2 rounded-full pl-1 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="size-9">
          <AvatarFallback className="bg-primary/15 text-sm font-medium text-primary">
            {sigla}
          </AvatarFallback>
        </Avatar>
        <div className="hidden leading-tight lg:block">
          <p className="max-w-40 truncate text-left text-sm font-medium text-foreground">
            {exibicao}
          </p>
          <p className="text-left text-xs text-muted-foreground">Minha conta</p>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <div className="flex flex-col gap-0.5 px-2 py-1.5">
          <span className="truncate text-sm font-medium text-foreground">
            {exibicao}
          </span>
          {nome && (
            <span className="truncate text-xs font-normal text-muted-foreground">
              {email}
            </span>
          )}
        </div>

        <DropdownMenuSeparator />

        {/* O logout continua sendo server action: limpa o cookie de sessão
            no servidor, coisa que um handler de clique não faria. */}
        <form action={sair}>
          {/* nativeButton: o Item do Base UI assume que o render NÃO é um
              <button>. Aqui é, porque quem dispara a server action é o submit
              do formulário. */}
          <DropdownMenuItem
            variant="destructive"
            nativeButton
            render={<button type="submit" className="w-full" />}
          >
            <LogOut className="size-4" />
            Sair
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
