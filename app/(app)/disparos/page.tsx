import { listarEtiquetas } from '@/lib/consultas/etiquetas'
import { ListaDisparos } from './lista-disparos'

export default async function Page() {
  const etiquetas = await listarEtiquetas()
  return <ListaDisparos etiquetas={etiquetas} />
}
