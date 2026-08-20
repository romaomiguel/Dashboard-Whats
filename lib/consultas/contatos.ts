import { criarClienteServidor } from '@/lib/supabase/server'

export type ContatoSalvo = {
  id: string
  nome: string
  numero: string
  etiqueta: string | null
  criadoEm: string
}

/**
 * Contatos do usuário logado, do mais novo para o mais antigo.
 *
 * Devolve lista vazia quando a tabela ainda não existe, para o app continuar
 * de pé antes de a migration 0003 rodar.
 */
export async function listarContatos(): Promise<ContatoSalvo[]> {
  const supabase = await criarClienteServidor()

  const { data, error } = await supabase
    .from('contatos')
    .select('id, nome, numero, criado_em, etiquetas ( nome )')
    .order('criado_em', { ascending: false })

  if (error || !data) return []

  return data.map((linha) => {
    const etiqueta = linha.etiquetas as { nome?: string } | null
    return {
      id: String(linha.id),
      nome: String(linha.nome),
      numero: String(linha.numero),
      etiqueta: etiqueta?.nome ?? null,
      criadoEm: String(linha.criado_em),
    }
  })
}
