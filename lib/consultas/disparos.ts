import { ehStatusDisparo, type Disparo } from '@/lib/disparos'
import { criarClienteServidor } from '@/lib/supabase/server'

/**
 * Campanhas do usuário logado, da mais recente para a mais antiga.
 *
 * Lista vazia quando as tabelas ainda não existem, para o app continuar de pé
 * antes de a migration 0006 rodar.
 */
export async function listarDisparos(): Promise<Disparo[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('disparos')
    .select(
      'id, nome, mensagem, agendado_para, status, total, enviados, falhas, instances ( nome ), etiquetas ( nome )',
    )
    .order('criado_em', { ascending: false })

  if (error || !data) return []

  return data.map((linha) => {
    const status = String(linha.status)
    const conexao = linha.instances as { nome?: string } | null
    const etiqueta = linha.etiquetas as { nome?: string } | null

    return {
      id: String(linha.id),
      nome: String(linha.nome),
      mensagem: String(linha.mensagem),
      conexao: conexao?.nome ?? null,
      publico: etiqueta?.nome ?? 'Todos os contatos',
      agendadoPara: String(linha.agendado_para),
      status: ehStatusDisparo(status) ? status : 'agendado',
      total: Number(linha.total),
      enviados: Number(linha.enviados),
      falhas: Number(linha.falhas),
    }
  })
}
