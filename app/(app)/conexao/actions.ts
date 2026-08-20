'use server'

import { revalidatePath } from 'next/cache'
import { TIMEOUT_ACORDAR_MS } from '@/lib/evolution/client'
import { EvolutionError } from '@/lib/evolution/errors'
import {
  conectarInstancia,
  criarInstancia,
  estadoInstancia,
  gerarNomeInstancia,
  removerInstancia,
} from '@/lib/evolution/instances'
import type { StatusConexao } from '@/lib/consultas/conexao'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoConexaoUi = {
  erro?: string
  ok?: boolean
  qr?: string
  status?: StatusConexao
}

async function usuarioAtual() {
  const supabase = await criarClienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/** Erro da Evolution traduzido para algo acionável na tela. */
function mensagemEvolution(erro: unknown): string {
  // Sem isto, uma falha da Evolution só existia como texto na tela e não
  // dava para saber, do servidor, o que tinha acontecido.
  console.error(
    '[conexao]',
    erro instanceof EvolutionError
      ? `${erro.kind}: ${erro.message}${erro.status ? ` (HTTP ${erro.status})` : ''}`
      : erro,
  )

  if (erro instanceof EvolutionError) {
    if (erro.kind === 'configuracao') {
      // Nomear a variável que falta poupa uma rodada de tentativa e erro.
      // Na Vercel, variável nova só vale a partir do próximo deploy — o
      // deploy em execução continua com o ambiente com que foi construído.
      return `Falta ${erro.message} no ambiente do servidor. Na Vercel: Settings › Environment Variables, confira o escopo (Production x Preview) e refaça o deploy — variável nova não entra em deploy já publicado.`
    }
    if (erro.kind === 'rede') {
      return 'A Evolution API não respondeu. No plano free do Render ela hiberna e leva até 90 segundos para acordar — tente de novo.'
    }
    if (erro.kind === 'autenticacao') {
      return 'A EVOLUTION_API_KEY foi recusada pelo servidor.'
    }
  }
  return 'Não foi possível falar com a Evolution API. Tente de novo.'
}

function urlDoWebhook(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')
  const segredo = process.env.WEBHOOK_SECRET ?? ''
  return `${base}/api/webhooks/evolution/${segredo}`
}

/**
 * Cria a instância na Evolution e devolve o QR para leitura.
 *
 * A primeira chamada pode pegar o Render dormindo, daí o timeout estendido.
 */
export async function criarConexao(): Promise<EstadoConexaoUi> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { data: existente } = await supabase
    .from('instances')
    .select('evolution_name')
    .maybeSingle()

  if (existente) {
    return { erro: 'Você já tem uma conexão. Remova a atual antes de criar outra.' }
  }

  const nome = gerarNomeInstancia()

  let qr: string | undefined
  try {
    const resposta = await criarInstancia(nome, urlDoWebhook(), {
      timeoutMs: TIMEOUT_ACORDAR_MS,
    })
    qr = resposta.qrcode?.base64
  } catch (erro) {
    return { erro: mensagemEvolution(erro) }
  }

  const { error } = await supabase
    .from('instances')
    .insert({ owner_id: user.id, evolution_name: nome, status: 'conectando' })

  if (error) {
    // Instância órfã na Evolution seria pior que nenhuma: desfaz.
    await removerInstancia(nome).catch(() => {})
    return { erro: 'Não foi possível registrar a conexão. Tente de novo.' }
  }

  revalidatePath('/conexao')
  return { ok: true, qr, status: 'conectando' }
}

/**
 * Busca um QR novo. O código do WhatsApp expira em cerca de um minuto, então
 * a tela precisa poder pedir outro sem recriar a instância.
 */
export async function atualizarQr(): Promise<EstadoConexaoUi> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { data: conexao } = await supabase
    .from('instances')
    .select('evolution_name')
    .maybeSingle()

  if (!conexao) return { erro: 'Nenhuma conexão para atualizar.' }

  try {
    const resposta = await conectarInstancia(String(conexao.evolution_name), {
      timeoutMs: TIMEOUT_ACORDAR_MS,
    })
    return { ok: true, qr: resposta.base64 }
  } catch (erro) {
    return { erro: mensagemEvolution(erro) }
  }
}

/**
 * Consulta o estado na Evolution e grava no banco.
 *
 * A tela chama isto em intervalo enquanto o QR está na tela: o webhook não
 * chega em desenvolvimento, porque a Evolution não alcança o localhost.
 */
export async function verificarConexao(): Promise<EstadoConexaoUi> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { data: conexao } = await supabase
    .from('instances')
    .select('id, evolution_name, status')
    .maybeSingle()

  if (!conexao) return { erro: 'Nenhuma conexão para verificar.' }

  let estado: string
  try {
    estado = await estadoInstancia(String(conexao.evolution_name))
  } catch (erro) {
    return { erro: mensagemEvolution(erro) }
  }

  const status: StatusConexao =
    estado === 'open' ? 'conectada' : estado === 'connecting' ? 'conectando' : 'desconectada'

  if (status !== conexao.status) {
    await supabase
      .from('instances')
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq('id', conexao.id)
      .eq('owner_id', user.id)

    revalidatePath('/conexao')
  }

  return { ok: true, status }
}

/** Desconecta e apaga a instância, na Evolution e no banco. */
export async function removerConexao(): Promise<EstadoConexaoUi> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const { data: conexao } = await supabase
    .from('instances')
    .select('id, evolution_name')
    .maybeSingle()

  if (!conexao) return { ok: true }

  // Se a Evolution estiver fora do ar, a linha some do mesmo jeito: manter um
  // registro que o usuário não consegue remover é pior que a instância órfã.
  await removerInstancia(String(conexao.evolution_name)).catch(() => {})

  const { error } = await supabase
    .from('instances')
    .delete()
    .eq('id', conexao.id)
    .eq('owner_id', user.id)

  if (error) return { erro: 'Não foi possível remover a conexão.' }

  revalidatePath('/conexao')
  return { ok: true }
}
