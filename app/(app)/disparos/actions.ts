'use server'

import { revalidatePath } from 'next/cache'
import {
  LIMITE_MENSAGEM,
  LIMITE_NOME_DISPARO,
  MINUTOS_AGORA,
  numeroParaWhatsApp,
} from '@/lib/disparos'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoDisparo = { erro?: string; ok?: boolean; total?: number }

async function usuarioAtual() {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

function mensagemDeBanco(codigo: string | undefined, padrao: string) {
  // PostgREST responde PGRST205 quando a tabela não está no schema cache.
  if (codigo === 'PGRST205' || codigo === '42P01') {
    return 'As tabelas de disparo ainda não existem. Rode a migration 0006 no Supabase.'
  }
  return padrao
}

/**
 * Cria a campanha e congela seus destinatários.
 *
 * Os contatos viram linhas em disparo_envios agora, e não na hora do envio:
 * mexer na base depois não muda para quem uma campanha agendada vai.
 */
export async function criarDisparo(
  _estadoAnterior: EstadoDisparo,
  formData: FormData,
): Promise<EstadoDisparo> {
  const nome = String(formData.get('nome') ?? '').trim()
  const instanceId = String(formData.get('conexao') ?? '').trim()
  const publico = String(formData.get('publico') ?? 'todos').trim()
  const mensagem = String(formData.get('mensagem') ?? '').trim()
  const quando = String(formData.get('quando') ?? 'agora')
  const agendadoEm = String(formData.get('agendado_para') ?? '')

  if (!nome) return { erro: 'Dê um nome à campanha.' }
  if (nome.length > LIMITE_NOME_DISPARO) {
    return { erro: `O nome deve ter no máximo ${LIMITE_NOME_DISPARO} caracteres.` }
  }
  if (!instanceId) return { erro: 'Escolha a conexão que vai enviar.' }
  if (!mensagem) return { erro: 'Escreva a mensagem que será enviada.' }
  if (mensagem.length > LIMITE_MENSAGEM) {
    return { erro: `A mensagem deve ter no máximo ${LIMITE_MENSAGEM} caracteres.` }
  }

  let agendadoPara: Date
  if (quando === 'agendar') {
    if (!agendadoEm) return { erro: 'Escolha a data e a hora do envio.' }
    agendadoPara = new Date(agendadoEm)
    if (Number.isNaN(agendadoPara.getTime())) {
      return { erro: 'Data de envio inválida.' }
    }
    if (agendadoPara.getTime() < Date.now()) {
      return { erro: 'A data de envio já passou.' }
    }
  } else {
    // "Agora" adia um minuto de propósito: dá tempo de cancelar um engano
    // antes que a primeira mensagem saia.
    agendadoPara = new Date(Date.now() + MINUTOS_AGORA * 60_000)
  }

  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { data: conexao } = await supabase
    .from('instances')
    .select('id, status')
    .eq('id', instanceId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!conexao) return { erro: 'Conexão não encontrada.' }
  if (conexao.status !== 'conectada') {
    return { erro: 'Essa conexão não está conectada. Leia o QR code antes de disparar.' }
  }

  let consulta = supabase
    .from('contatos')
    .select('nome, numero')
    .eq('owner_id', user.id)

  if (publico !== 'todos') consulta = consulta.eq('etiqueta_id', publico)

  const { data: contatos, error: erroContatos } = await consulta

  if (erroContatos) {
    return { erro: mensagemDeBanco(erroContatos.code, 'Não foi possível ler os contatos.') }
  }

  // Número que a Evolution não aceitaria vira falha silenciosa lá na frente;
  // melhor descartar aqui e dizer o total real.
  const destinatarios = (contatos ?? [])
    .map((c) => ({
      nome: String(c.nome),
      numero: numeroParaWhatsApp(String(c.numero)),
    }))
    .filter((c): c is { nome: string; numero: string } => Boolean(c.numero))

  if (destinatarios.length === 0) {
    return {
      erro:
        publico === 'todos'
          ? 'Você não tem contatos com número válido para disparar.'
          : 'Nenhum contato com essa etiqueta tem número válido.',
    }
  }

  const { data: disparo, error } = await supabase
    .from('disparos')
    .insert({
      owner_id: user.id,
      nome,
      instance_id: instanceId,
      etiqueta_id: publico === 'todos' ? null : publico,
      mensagem,
      agendado_para: agendadoPara.toISOString(),
      total: destinatarios.length,
    })
    .select('id')
    .single()

  if (error) {
    return { erro: mensagemDeBanco(error.code, 'Não foi possível criar o disparo.') }
  }

  const { error: erroEnvios } = await supabase.from('disparo_envios').insert(
    destinatarios.map((d) => ({
      disparo_id: disparo.id,
      owner_id: user.id,
      nome: d.nome,
      numero: d.numero,
    })),
  )

  if (erroEnvios) {
    // Campanha sem destinatário nunca sairia do lugar: desfaz.
    await supabase.from('disparos').delete().eq('id', disparo.id)
    return {
      erro: mensagemDeBanco(erroEnvios.code, 'Não foi possível montar a lista de envio.'),
    }
  }

  revalidatePath('/disparos')
  return { ok: true, total: destinatarios.length }
}

/** Cancela uma campanha que ainda não terminou. */
export async function cancelarDisparo(id: string): Promise<EstadoDisparo> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { error } = await supabase
    .from('disparos')
    .update({ status: 'cancelado', atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user.id)
    .in('status', ['agendado', 'enviando'])

  if (error) return { erro: 'Não foi possível cancelar.' }

  revalidatePath('/disparos')
  return { ok: true }
}
