import { buscarConexao } from '@/lib/consultas/conexao'
import { SeloDadosExemplo } from '@/components/selo-dados-exemplo'
import { ListaExemplo } from './lista-exemplo'
import { PainelConexao } from './painel-conexao'

export default async function Page() {
  const conexao = await buscarConexao()

  return (
    <>
      <SeloDadosExemplo />
      <PainelConexao conexao={conexao} />
      {/* Enquanto não há conexão real, os cartões de amostra mostram como a
          tela fica quando houver. Somem ao zerar o exemplo. */}
      {!conexao && <ListaExemplo />}
    </>
  )
}
