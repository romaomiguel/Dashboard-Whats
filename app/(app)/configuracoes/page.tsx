import { redirect } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { listarEtiquetas } from '@/lib/consultas/etiquetas'
import { buscarPreferencias } from '@/lib/consultas/preferencias'
import { nomeDoPerfil, usuarioLogado } from '@/lib/consultas/sessao'
import { EtiquetasCard } from './etiquetas-card'
import { FormularioPerfil } from './formulario-perfil'
import { Preferencias } from './preferencias'

export default async function Page() {
  // usuarioLogado e nomeDoPerfil já foram resolvidos pelo layout nesta mesma
  // requisição; aqui saem do cache, sem nova ida ao Supabase.
  const [usuario, nome, etiquetas, preferencias] = await Promise.all([
    usuarioLogado(),
    nomeDoPerfil(),
    listarEtiquetas(),
    buscarPreferencias(),
  ])

  if (!usuario) redirect('/login')

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Perfil</CardTitle>
            <CardDescription>Informações da sua conta</CardDescription>
          </CardHeader>
          <CardContent>
            <FormularioPerfil nome={nome} email={usuario.email ?? ''} />
          </CardContent>
        </Card>

        <EtiquetasCard etiquetas={etiquetas} />
      </div>

      <Preferencias preferencias={preferencias} />
    </div>
  )
}
