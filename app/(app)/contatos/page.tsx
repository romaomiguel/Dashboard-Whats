import { listarEtiquetas } from '@/lib/consultas/etiquetas'
import { ListaContatos } from './lista-contatos'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>
}) {
  // A busca vem pela URL para que o campo da topbar leve a algum lugar e o
  // resultado seja compartilhável por link.
  const [{ busca }, etiquetas] = await Promise.all([
    searchParams,
    listarEtiquetas(),
  ])

  return <ListaContatos etiquetas={etiquetas} buscaInicial={busca ?? ''} />
}
