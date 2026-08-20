import { redirect } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { criarClienteServidor } from '@/lib/supabase/server'
import { FormularioPerfil } from './formulario-perfil'
import { Preferencias } from './preferencias'

export default async function Page() {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('profiles')
    .select('nome')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil</CardTitle>
          <CardDescription>Informações da sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioPerfil
            nome={perfil?.nome ?? ''}
            email={user.email ?? ''}
          />
        </CardContent>
      </Card>

      <Preferencias />
    </div>
  )
}
