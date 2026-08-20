import { listarConversas } from '@/lib/consultas/mensagens'
import { ListaConversas } from './lista-conversas'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>
}) {
  const [{ busca }, conversas] = await Promise.all([
    searchParams,
    listarConversas(),
  ])

  return <ListaConversas conversas={conversas} buscaInicial={busca ?? ''} />
}
