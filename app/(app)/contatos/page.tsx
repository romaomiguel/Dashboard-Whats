import { listarContatos } from '@/lib/consultas/contatos'
import { listarEtiquetas } from '@/lib/consultas/etiquetas'
import { ListaContatos } from './lista-contatos'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>
}) {
  // A busca vem pela URL para que o campo da topbar leve a algum lugar e o
  // resultado seja compartilhável por link.
  const [{ busca }, contatos, etiquetas] = await Promise.all([
    searchParams,
    listarContatos(),
    listarEtiquetas(),
  ])

  return (
    <ListaContatos
      contatos={contatos}
      etiquetas={etiquetas}
      buscaInicial={busca ?? ''}
    />
  )
}
