import { listarEsteira } from '@/lib/consultas/esteira'
import { Quadro } from './quadro'

export default async function Page() {
  const { etapas, contatos } = await listarEsteira()
  return <Quadro etapas={etapas} contatos={contatos} />
}
