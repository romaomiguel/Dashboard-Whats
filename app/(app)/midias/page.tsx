import { listarMidias } from '@/lib/consultas/midias'
import { ListaMidias } from './lista-midias'

export default async function Page() {
  const midias = await listarMidias()
  return <ListaMidias midias={midias} />
}
