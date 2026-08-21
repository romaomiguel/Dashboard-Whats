import { criarClienteServidor } from '@/lib/supabase/server'

export type Etapa = { id: string; nome: string; ordem: number }
export type ContatoNaEsteira = {
  id: string
  nome: string
  numero: string
  etapaId: string | null
}

/**
 * O funil inteiro numa ida só.
 *
 * Contato sem etapa entra na coluna "Sem etapa" da tela: escondê-lo faria
 * sumir da vista quem acabou de ser importado, que é justamente quem precisa
 * ser triado.
 */
export async function listarEsteira(): Promise<{
  etapas: Etapa[]
  contatos: ContatoNaEsteira[]
}> {
  const supabase = await criarClienteServidor()

  const [etapas, contatos] = await Promise.all([
    supabase.from('etapas').select('id, nome, ordem').order('ordem'),
    supabase.from('contatos').select('id, nome, numero, etapa_id').order('nome'),
  ])

  return {
    etapas: (etapas.data ?? []).map((e) => ({
      id: String(e.id),
      nome: String(e.nome),
      ordem: Number(e.ordem),
    })),
    contatos: (contatos.data ?? []).map((c) => ({
      id: String(c.id),
      nome: String(c.nome),
      numero: String(c.numero),
      etapaId: c.etapa_id ? String(c.etapa_id) : null,
    })),
  }
}
