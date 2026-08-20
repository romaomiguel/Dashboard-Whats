'use server'

import { revalidatePath } from 'next/cache'
import { BUCKET_MIDIAS, ehTipoValido, LIMITE_TAMANHO } from '@/lib/midias'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoMidia = { erro?: string; ok?: boolean }

async function usuarioAtual() {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

function mensagemDeErro(codigo: string | undefined, padrao: string) {
  // PostgREST responde PGRST205 quando a tabela não está no schema cache.
  if (codigo === 'PGRST205' || codigo === '42P01') {
    return 'A tabela de mídias ainda não existe. Rode a migration 0004 no Supabase.'
  }
  return padrao
}

/**
 * Grava o registro da mídia depois que o navegador subiu o arquivo direto
 * para o Storage.
 *
 * O upload não passa por aqui de propósito: server action tem limite de
 * corpo, e um vídeo de 16 MB estouraria o limite bem antes de chegar.
 */
export async function registrarMidia(
  _estadoAnterior: EstadoMidia,
  formData: FormData,
): Promise<EstadoMidia> {
  const nome = String(formData.get('nome') ?? '').trim()
  const tipo = String(formData.get('tipo') ?? '')
  const caminho = String(formData.get('caminho') ?? '').trim()
  const legenda = String(formData.get('legenda') ?? '').trim()
  const tamanho = Number(formData.get('tamanho') ?? 0)

  if (!nome || !caminho) return { erro: 'Escolha um arquivo antes de enviar.' }
  if (!ehTipoValido(tipo)) return { erro: 'Tipo de arquivo não reconhecido.' }
  if (!Number.isFinite(tamanho) || tamanho <= 0) {
    return { erro: 'Arquivo vazio ou ilegível.' }
  }
  if (tamanho > LIMITE_TAMANHO) return { erro: 'O arquivo passa de 16 MB.' }

  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  // O caminho vem do navegador: confirmar que aponta para a pasta do próprio
  // usuário impede alguém de registrar o arquivo de outro como seu.
  if (!caminho.startsWith(`${user.id}/`)) {
    return { erro: 'Caminho de arquivo inválido.' }
  }

  const { error } = await supabase.from('midias').insert({
    owner_id: user.id,
    nome: nome.slice(0, 200),
    tipo,
    tamanho,
    caminho,
    legenda: legenda || null,
  })

  if (error) {
    // O arquivo já subiu; sem registro ele viraria lixo no bucket.
    await supabase.storage.from(BUCKET_MIDIAS).remove([caminho])
    return { erro: mensagemDeErro(error.code, 'Não foi possível salvar a mídia.') }
  }

  revalidatePath('/midias')
  return { ok: true }
}

export async function excluirMidia(id: string): Promise<EstadoMidia> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { data: midia } = await supabase
    .from('midias')
    .select('caminho')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!midia) return { erro: 'Mídia não encontrada.' }

  const { error } = await supabase
    .from('midias')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return { erro: 'Não foi possível excluir. Tente de novo.' }

  // Apagar o registro primeiro: um arquivo órfão no bucket é menos ruim que
  // uma linha apontando para arquivo que já não existe.
  await supabase.storage.from(BUCKET_MIDIAS).remove([String(midia.caminho)])

  revalidatePath('/midias')
  return { ok: true }
}
