import type { Papel } from '@/lib/funil'
import { chaveDoNumero } from '@/lib/numeros'
import { criarClienteServidor } from '@/lib/supabase/server'

export type Etapa = { id: string; nome: string; ordem: number; papel: Papel | null }

export type LinhaDoFunil = {
  /** Id da linha do funil — é este que `moverNoFunil` recebe. */
  id: string
  nome: string
  numero: string
  etapaId: string | null
}

/** Teto da varredura de nomes; o mesmo espírito de `listarConversas`. */
const LIMITE_NOMES = 500

/**
 * O funil inteiro, com o nome de exibição resolvido.
 *
 * O nome sai, nesta ordem, do contato cadastrado, do pushName da última
 * mensagem, ou do próprio número. A reconciliação é em memória e pela chave
 * canônica porque as três tabelas gravam o número em formas diferentes —
 * casar por igualdade crua mostraria o número no lugar do nome justamente
 * nas conversas que vieram de disparo.
 */
export async function listarEsteira(): Promise<{
  etapas: Etapa[]
  linhas: LinhaDoFunil[]
}> {
  const supabase = await criarClienteServidor()

  const [etapas, funil, contatos, mensagens] = await Promise.all([
    supabase.from('etapas').select('id, nome, ordem, papel').order('ordem'),
    supabase.from('funil').select('id, chave_numero, numero, etapa_id'),
    supabase.from('contatos').select('nome, numero'),
    supabase
      .from('mensagens')
      .select('numero, nome')
      .order('criado_em', { ascending: false })
      .limit(LIMITE_NOMES),
  ])

  const porContato = new Map<string, string>()
  for (const c of contatos.data ?? []) {
    if (c.nome) porContato.set(chaveDoNumero(String(c.numero)), String(c.nome))
  }

  // A lista vem da mais nova para a mais antiga; o primeiro nome que
  // aparecer é o mais recente, então não sobrescrever.
  const porPushName = new Map<string, string>()
  for (const m of mensagens.data ?? []) {
    const chave = chaveDoNumero(String(m.numero))
    if (m.nome && !porPushName.has(chave)) porPushName.set(chave, String(m.nome))
  }

  return {
    etapas: (etapas.data ?? []).map((e) => ({
      id: String(e.id),
      nome: String(e.nome),
      ordem: Number(e.ordem),
      papel: e.papel ? (String(e.papel) as Papel) : null,
    })),
    linhas: (funil.data ?? []).map((f) => {
      const chave = String(f.chave_numero)
      const numero = String(f.numero)
      return {
        id: String(f.id),
        nome: porContato.get(chave) ?? porPushName.get(chave) ?? numero,
        numero,
        etapaId: f.etapa_id ? String(f.etapa_id) : null,
      }
    }),
  }
}
