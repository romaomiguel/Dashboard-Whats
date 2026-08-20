import { ListaConversas } from './lista-conversas'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>
}) {
  const { busca } = await searchParams
  return <ListaConversas buscaInicial={busca ?? ''} />
}
