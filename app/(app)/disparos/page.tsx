import { listarConexoes } from '@/lib/consultas/conexao'
import { listarEtiquetas } from '@/lib/consultas/etiquetas'
import { ListaDisparos } from './lista-disparos'

export default async function Page() {
  const [etiquetas, conexoes] = await Promise.all([
    listarEtiquetas(),
    listarConexoes(),
  ])

  return <ListaDisparos etiquetas={etiquetas} conexoes={conexoes} />
}
