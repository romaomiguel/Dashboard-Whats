import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'
import { criarClienteServidor } from '@/lib/supabase/server'

export default async function LayoutApp({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // O middleware já barra anônimos; esta checagem é a segunda tranca,
  // caso o matcher do middleware mude.
  if (!user) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar email={user.email ?? ''} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
