import { redirect } from 'next/navigation'
import { DadosExemploProvider } from '@/components/dados-exemplo-provider'
import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'
import { listarNotificacoes } from '@/lib/consultas/notificacoes'
import { nomeDoPerfil, usuarioLogado } from '@/lib/consultas/sessao'

export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode
}) {
  const usuario = await usuarioLogado()

  // O middleware já barra anônimos; esta checagem é a segunda tranca,
  // caso o matcher do middleware mude.
  if (!usuario) redirect('/login')

  const [nome, notificacoes] = await Promise.all([
    nomeDoPerfil(),
    listarNotificacoes(),
  ])

  return (
    <DadosExemploProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <div className="hidden md:block">
          <Sidebar />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar
            nome={nome}
            email={usuario.email ?? ''}
            ownerId={usuario.id}
            notificacoes={notificacoes}
          />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto flex max-w-7xl flex-col gap-6">{children}</div>
          </main>
        </div>
      </div>
    </DadosExemploProvider>
  )
}
