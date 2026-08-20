import { SeloDadosExemplo } from '@/components/selo-dados-exemplo'
import { listarConexoes } from '@/lib/consultas/conexao'
import { ListaExemplo } from './lista-exemplo'
import { PainelConexao } from './painel-conexao'

export default async function Page() {
  const conexoes = await listarConexoes()

  return (
    <>
      <SeloDadosExemplo />
      <PainelConexao conexoes={conexoes} />
      {/* Enquanto não há conexão real, os cartões de amostra mostram como a
          tela fica quando houver. Somem ao zerar o exemplo. */}
      {conexoes.length === 0 && <ListaExemplo />}
    </>
  )
}
