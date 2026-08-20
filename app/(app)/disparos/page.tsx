import { listarConexoes } from '@/lib/consultas/conexao'
import { listarDisparos } from '@/lib/consultas/disparos'
import { listarEtiquetas } from '@/lib/consultas/etiquetas'
import { ListaDisparos } from './lista-disparos'

export default async function Page() {
  const [etiquetas, conexoes, disparos] = await Promise.all([
    listarEtiquetas(),
    listarConexoes(),
    listarDisparos(),
  ])

  return (
    <ListaDisparos
      etiquetas={etiquetas}
      conexoes={conexoes}
      disparos={disparos}
    />
  )
}
