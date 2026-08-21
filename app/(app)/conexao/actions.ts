'use server'

import { revalidatePath } from 'next/cache'
import { descobrirUrlDoApp } from '@/lib/app-url'
import { chamar, TIMEOUT_ACORDAR_MS } from '@/lib/evolution/client'
import { endpoints } from '@/lib/evolution/endpoints'
import { EvolutionError } from '@/lib/evolution/errors'
import {
  conectarInstancia,
  criarInstancia,
  definirWebhook,
  estadoInstancia,
  gerarNomeInstancia,
  removerInstancia,
} from '@/lib/evolution/instances'
import { LIMITE_NOME_CONEXAO, type StatusConexao } from '@/lib/conexoes'
import { chavesOrfas } from '@/lib/notificacoes'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoConexaoUi = {
  erro?: string
  ok?: boolean
  qr?: string
  id?: string
  status?: StatusConexao
  numero?: string | null
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
      return `Falta ${erro.message} no ambiente do servidor. Na Vercel: Settings › Environment Variables, confira o escopo (Production x Preview) e refaça o deploy — variável nova não entra em deploy já publicado.`
    }
    if (erro.kind === 'rede') {
      return 'A Evolution API não respondeu. No plano free do Render ela hiberna e leva até 90 segundos para acordar — tente de novo.'
    }
    if (erro.kind === 'autenticacao') {
      return 'A EVOLUTION_API_KEY foi recusada pelo servidor.'
    }
    if (erro.kind === 'nome_invalido') {
      return 'Esta conexão está com um nome inválido no banco e não dá para usar. Remova e crie outra.'
    }
  }
  return 'Não foi possível falar com a Evolution API. Tente de novo.'
}

/**
 * Endereço que a Evolution vai chamar quando algo acontecer.
 *
 * A descoberta fica em lib/app-url.ts, que prefere variáveis lidas em tempo de
 * execução. Na Vercel funciona sem configurar nada.
 */
function urlDoWebhook(): string {
  const base = descobrirUrlDoApp(process.env)
  const segredo = process.env.WEBHOOK_SECRET ?? ''

  if (!base) {
    throw new EvolutionError(
      'configuracao',
      'o endereço público do app (defina APP_URL, ou publique na Vercel, que injeta o domínio sozinha)',
    )
  }
  if (!segredo) {
    throw new EvolutionError('configuracao', 'WEBHOOK_SECRET')
  }

  return `${base}/api/webhooks/evolution/${segredo}`
}


function mensagemDeBanco(codigo: string | undefined, padrao: string) {
  if (codigo === '23505') return 'Você já tem uma conexão com esse nome.'
  // PostgREST responde PGRST204 quando a coluna não está no schema cache.
  if (codigo === 'PGRST204' || codigo === '42703') {
    return 'A coluna de nome ainda não existe. Rode a migration 0005 no Supabase.'
  }
  return padrao
}

/** Só a linha do próprio usuário, para nenhuma ação alcançar conexão alheia. */
async function conexaoDoUsuario(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  id: string,
  ownerId: string,
) {
  const { data } = await supabase
    .from('instances')
    .select('id, evolution_name, status')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle()
  return data
}

/**
 * Cria uma conexão na Evolution e devolve o QR para leitura.
 *
 * A primeira chamada pode pegar o Render dormindo, daí o timeout estendido.
 */
export async function criarConexao(
  _estadoAnterior: EstadoConexaoUi,
  formData: FormData,
): Promise<EstadoConexaoUi> {
  const nome = String(formData.get('nome') ?? '').trim()

  if (!nome) return { erro: 'Dê um nome à conexão.' }
  if (nome.length > LIMITE_NOME_CONEXAO) {
    return { erro: `O nome deve ter no máximo ${LIMITE_NOME_CONEXAO} caracteres.` }
  }

  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const nomeEvolution = gerarNomeInstancia()

  let qr: string | undefined
  try {
    // urlDoWebhook lança se o ambiente estiver incompleto; melhor falhar aqui
    // do que criar uma instância que nunca receberia evento.
    const resposta = await criarInstancia(nomeEvolution, urlDoWebhook(), {
      timeoutMs: TIMEOUT_ACORDAR_MS,
    })
    qr = resposta.qrcode?.base64
  } catch (erro) {
    return { erro: mensagemEvolution(erro) }
  }

  const { data, error } = await supabase
    .from('instances')
    .insert({
      owner_id: user.id,
      nome,
      evolution_name: nomeEvolution,
      status: 'conectando',
    })
    .select('id')
    .single()

  if (error) {
    // Instância órfã na Evolution seria pior que nenhuma: desfaz.
    await removerInstancia(nomeEvolution).catch(() => {})
    return {
      erro: mensagemDeBanco(error.code, 'Não foi possível registrar a conexão.'),
    }
  }

  revalidatePath('/conexao')
  return { ok: true, qr, id: String(data.id), status: 'conectando' }
}

/**
 * Busca um QR novo. O código do WhatsApp expira em cerca de um minuto, então
 * a tela precisa poder pedir outro sem recriar a conexão.
 */
export async function atualizarQr(id: string): Promise<EstadoConexaoUi> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const conexao = await conexaoDoUsuario(supabase, id, user.id)
  if (!conexao) return { erro: 'Conexão não encontrada.' }

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
 * Número do aparelho conectado, extraído do jid que a Evolution devolve.
 *
 * Vem de fetchInstances porque connectionState só informa o estado. Falha
 * aqui não derruba a verificação: o número é enfeite, o estado é o que
 * importa.
 */
async function numeroDaInstancia(nomeEvolution: string): Promise<string | null> {
  try {
    const lista = await chamar<unknown>(endpoints.instancia.listar())
    if (!Array.isArray(lista)) return null

    const encontrada = lista.find(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item as { name?: string }).name === nomeEvolution,
    ) as { ownerJid?: string; number?: string } | undefined

    const jid = encontrada?.ownerJid ?? encontrada?.number
    if (!jid) return null

    const digitos = String(jid).split('@')[0].replace(/\D/g, '')
    return digitos ? `+${digitos}` : null
  } catch {
    return null
  }
}

/**
 * Consulta o estado na Evolution e grava no banco.
 *
 * A tela chama isto em intervalo enquanto o QR está aberto: o webhook não
 * chega em desenvolvimento, porque a Evolution não alcança o localhost.
 */
export async function verificarConexao(id: string): Promise<EstadoConexaoUi> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const conexao = await conexaoDoUsuario(supabase, id, user.id)
  if (!conexao) return { erro: 'Conexão não encontrada.' }

  let estado: string
  try {
    estado = await estadoInstancia(String(conexao.evolution_name))
  } catch (erro) {
    return { erro: mensagemEvolution(erro) }
  }

  const status: StatusConexao =
    estado === 'open'
      ? 'conectada'
      : estado === 'connecting'
        ? 'conectando'
        : 'desconectada'

  const numero =
    status === 'conectada'
      ? await numeroDaInstancia(String(conexao.evolution_name))
      : null

  if (status !== conexao.status || numero) {
    await supabase
      .from('instances')
      .update({
        status,
        ...(numero ? { numero } : {}),
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', conexao.id)
      .eq('owner_id', user.id)

    revalidatePath('/conexao')
  }

  return { ok: true, status, numero }
}

/**
 * Apaga as notificações que ficaram sem objeto depois do cascade.
 *
 * Falha aqui não desfaz a remoção: a conexão já saiu, e devolver erro faria o
 * usuário tentar de novo uma remoção que já aconteceu. O pior caso é sobrar a
 * notificação órfã que existia antes desta função.
 */
async function limparNotificacoesOrfas(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  ownerId: string,
  instanceId: string,
  numerosDaConexao: string[],
) {
  // Depois do cascade: o que sobrou é conversa que ainda vive em outra
  // conexão, e cuja notificação continua tendo para onde levar.
  const { data: restantes } = await supabase
    .from('mensagens')
    .select('numero')
    .eq('owner_id', ownerId)

  const chaves = chavesOrfas({
    instanceId,
    numerosDaConexao,
    numerosRemanescentes: (restantes ?? []).map((linha) => String(linha.numero)),
  })

  const { error } = await supabase
    .from('notificacoes')
    .delete()
    .eq('owner_id', ownerId)
    .in('chave', chaves)

  if (error) {
    console.error('[conexao] notificações órfãs ficaram:', error.code, error.message)
  }
}

/** Desconecta e apaga a conexão, na Evolution e no banco. */
export async function removerConexao(id: string): Promise<EstadoConexaoUi> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const conexao = await conexaoDoUsuario(supabase, id, user.id)
  if (!conexao) return { ok: true }

  // Timeout longo: com a Evolution hibernando, o curto falhava, o catch
  // engolia o erro e a instância ficava órfã lá — continuando a tentar
  // reconectar com o mesmo número, o que faz o WhatsApp deslogar todas.
  let sobrouOrfa = false
  try {
    await removerInstancia(String(conexao.evolution_name), {
      timeoutMs: TIMEOUT_ACORDAR_MS,
    })
  } catch (erro) {
    sobrouOrfa = true
    console.error('[conexao] instância órfã na Evolution:', erro)
  }

  // Lido antes do delete: o cascade da 0011 leva estas mensagens junto, e
  // depois não haveria como saber de quais conversas eram.
  const { data: antes } = await supabase
    .from('mensagens')
    .select('numero')
    .eq('instance_id', conexao.id)
    .eq('owner_id', user.id)

  const { error } = await supabase
    .from('instances')
    .delete()
    .eq('id', conexao.id)
    .eq('owner_id', user.id)

  if (error) return { erro: 'Não foi possível remover a conexão.' }

  await limparNotificacoesOrfas(
    supabase,
    user.id,
    String(conexao.id),
    (antes ?? []).map((linha) => String(linha.numero)),
  )

  // '/', 'layout' e não só '/conexao': o sino vive no layout e acabou de
  // perder notificações, então a topbar precisa ser refeita também.
  revalidatePath('/', 'layout')

  // A linha sai de qualquer jeito — deixar um registro que o usuário não
  // consegue apagar seria pior —, mas ele precisa saber que sobrou lixo.
  if (sobrouOrfa) {
    return {
      ok: true,
      erro: 'A conexão saiu daqui, mas a Evolution não respondeu e a instância ficou lá. Use "Limpar órfãs".',
    }
  }

  return { ok: true }
}

/**
 * Remove da Evolution as instâncias que não têm registro no app.
 *
 * Elas surgem quando a remoção falha pela metade. Cada uma continua tentando
 * reconectar com o mesmo número, e sessões duplicadas fazem o WhatsApp
 * deslogar o aparelho — foi o que derrubou a conexão em 20/08.
 */
export async function limparOrfas(): Promise<EstadoConexaoUi & { removidas?: number }> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  let instancias: unknown
  try {
    instancias = await chamar<unknown>(endpoints.instancia.listar(), {
      timeoutMs: TIMEOUT_ACORDAR_MS,
    })
  } catch (erro) {
    return { erro: mensagemEvolution(erro) }
  }

  if (!Array.isArray(instancias)) return { erro: 'Resposta inesperada da Evolution.' }

  // Compara com a tabela inteira, não só com as deste usuário: apagar a
  // instância de outra conta seria bem pior que deixar uma órfã.
  const { data: registradas } = await supabase
    .from('instances')
    .select('evolution_name')

  const conhecidas = new Set(
    (registradas ?? []).map((r) => String(r.evolution_name)),
  )

  const orfas = instancias
    .map((i) => (i as { name?: string })?.name)
    .filter((nome): nome is string => typeof nome === 'string' && nome.length > 0)
    .filter((nome) => !conhecidas.has(nome))

  let removidas = 0
  for (const nome of orfas) {
    try {
      await removerInstancia(nome)
      removidas += 1
    } catch (erro) {
      console.error('[conexao] falha ao remover órfã', nome, erro)
    }
  }

  revalidatePath('/conexao')
  return { ok: true, removidas }
}

/**
 * Reaponta o webhook de uma conexão já existente.
 *
 * Serve para consertar sem ter que apagar a conexão e ler o QR de novo —
 * quem criou a instância antes de a NEXT_PUBLIC_APP_URL existir ficou com um
 * endereço relativo gravado lá.
 */
export async function corrigirWebhook(id: string): Promise<EstadoConexaoUi> {
  const { supabase, user } = await usuarioAtual()
  if (!user) return { erro: 'Sessão expirada. Entre novamente.' }

  const conexao = await conexaoDoUsuario(supabase, id, user.id)
  if (!conexao) return { erro: 'Conexão não encontrada.' }

  try {
    await definirWebhook(String(conexao.evolution_name), urlDoWebhook(), {
      timeoutMs: TIMEOUT_ACORDAR_MS,
    })
  } catch (erro) {
    return { erro: mensagemEvolution(erro) }
  }

  return { ok: true }
}
