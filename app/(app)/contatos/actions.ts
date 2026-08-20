'use server'

import { revalidatePath } from 'next/cache'
import { lerCsv, semCabecalho } from '@/lib/csv'
import { LIMITE_IMPORTACAO, LIMITE_NOME, LIMITE_NUMERO } from '@/lib/contatos'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoContato = { erro?: string; ok?: boolean; criados?: number }

async function usuarioAtual() {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/** Erro de banco traduzido para algo que o usuário consiga agir. */
function mensagemDeErro(codigo: string | undefined, padrao: string) {
  if (codigo === '23505') return 'Já existe um contato com esse número.'
  if (codigo === '42P01') return 'Rode a migration 0003 no Supabase antes de cadastrar.'
  return padrao
}

export async function criarContato(
  _estadoAnterior: EstadoContato,
  formData: FormData,
): Promise<EstadoContato> {
  const nome = String(formData.get('nome') ?? '').trim()
  const numero = String(formData.get('numero') ?? '').trim()
  const etiquetaId = String(formData.get('etiqueta_id') ?? '').trim()

  if (!nome) return { erro: 'Informe o nome do contato.' }
  if (nome.length > LIMITE_NOME) {
    return { erro: `O nome deve ter no máximo ${LIMITE_NOME} caracteres.` }
  }
  if (!numero) return { erro: 'Informe o número de WhatsApp.' }
  if (numero.length > LIMITE_NUMERO) {
    return { erro: `O número deve ter no máximo ${LIMITE_NUMERO} caracteres.` }
  }

  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { error } = await supabase.from('contatos').insert({
    owner_id: user.id,
    nome,
    numero,
    etiqueta_id: etiquetaId || null,
  })

  if (error) {
    return { erro: mensagemDeErro(error.code, 'Não foi possível salvar o contato.') }
  }

  revalidatePath('/contatos')
  return { ok: true, criados: 1 }
}

export async function excluirContatos(ids: string[]): Promise<EstadoContato> {
  if (ids.length === 0) return { ok: true }

  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  // A RLS já limita às próprias linhas; o filtro por owner_id é a segunda
  // tranca, caso a policy mude.
  const { error } = await supabase
    .from('contatos')
    .delete()
    .in('id', ids)
    .eq('owner_id', user.id)

  if (error) return { erro: 'Não foi possível excluir. Tente de novo.' }

  revalidatePath('/contatos')
  return { ok: true }
}

export async function importarContatos(
  _estadoAnterior: EstadoContato,
  formData: FormData,
): Promise<EstadoContato> {
  const conteudo = String(formData.get('conteudo') ?? '')

  if (!conteudo.trim()) return { erro: 'Escolha um arquivo CSV com os contatos.' }

  const linhas = semCabecalho(lerCsv(conteudo))
  if (linhas.length === 0) return { erro: 'O arquivo não tem nenhuma linha de contato.' }
  if (linhas.length > LIMITE_IMPORTACAO) {
    return { erro: `Importe no máximo ${LIMITE_IMPORTACAO} contatos por vez.` }
  }

  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { data: etiquetas } = await supabase.from('etiquetas').select('id, nome')
  const idPorNome = new Map(
    (etiquetas ?? []).map((e) => [String(e.nome).toLowerCase(), String(e.id)]),
  )

  const vistos = new Set<string>()
  const registros: {
    owner_id: string
    nome: string
    numero: string
    etiqueta_id: string | null
  }[] = []

  for (const [nomeBruto, numeroBruto, etiquetaBruta] of linhas) {
    const nome = (nomeBruto ?? '').trim().slice(0, LIMITE_NOME)
    const numero = (numeroBruto ?? '').trim().slice(0, LIMITE_NUMERO)

    // Linha sem nome ou sem número não vira contato — e número repetido
    // dentro do próprio arquivo entraria em conflito com ele mesmo.
    if (!nome || !numero || vistos.has(numero)) continue
    vistos.add(numero)

    registros.push({
      owner_id: user.id,
      nome,
      numero,
      etiqueta_id: idPorNome.get((etiquetaBruta ?? '').trim().toLowerCase()) ?? null,
    })
  }

  if (registros.length === 0) {
    return { erro: 'Nenhuma linha tinha nome e número preenchidos.' }
  }

  // ignoreDuplicates: reimportar a mesma planilha atualiza o que falta em vez
  // de falhar inteira no primeiro número repetido.
  const { error } = await supabase
    .from('contatos')
    .upsert(registros, { onConflict: 'owner_id,numero', ignoreDuplicates: true })

  if (error) {
    return { erro: mensagemDeErro(error.code, 'Não foi possível importar os contatos.') }
  }

  revalidatePath('/contatos')
  return { ok: true, criados: registros.length }
}
