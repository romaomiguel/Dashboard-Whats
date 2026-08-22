import { listarEsteira } from '@/lib/consultas/esteira'
import { Quadro } from './quadro'

export default async function Page() {
  const { etapas, linhas } = await listarEsteira()
  return <Quadro etapas={etapas} linhas={linhas} />
}
