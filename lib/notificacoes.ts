import { chaveDoNumero } from '@/lib/numeros'

export const TIPOS_NOTIFICACAO = ['mensagem', 'disparo', 'conexao'] as const

export type TipoNotificacao = (typeof TIPOS_NOTIFICACAO)[number]

export type Notificacao = {
  id: string
  tipo: TipoNotificacao
  titulo: string
  corpo: string | null
  destino: string | null
  lida: boolean
  quando: string
}

/** Coluna de `profiles` que decide se cada tipo chega a ser criado. */
export const PREFERENCIA_POR_TIPO = {
  mensagem: 'notificar_mensagem',
  disparo: 'notificar_disparo',
  conexao: 'notificar_conexao',
} as const

export type ColunaPreferencia =
  (typeof PREFERENCIA_POR_TIPO)[TipoNotificacao]

export const DIAS_RETENCAO = 30

/** Corpo mais longo que isto vira parede de texto no painel. */
const LIMITE_CORPO = 120

/** Espelha o `check (length(trim(titulo)) between 1 and 120)` da 0012. */
const LIMITE_TITULO = 120

export type EventoNotificavel =
  | { tipo: 'mensagem'; numero: string; nome: string | null; texto: string }
  | { tipo: 'disparo'; id: string; nome: string; enviados: number; total: number }
  | { tipo: 'conexao'; id: string; nome: string }

export type NotificacaoMontada = {
  tipo: TipoNotificacao
  chave: string
  titulo: string
  corpo: string | null
  destino: string
}

function encurtar(texto: string): string {
  const limpo = texto.trim()
  if (limpo.length <= LIMITE_CORPO) return limpo
  return `${limpo.slice(0, LIMITE_CORPO - 1)}…`
}

/**
 * Monta "<quem> <sufixo>" garantindo que caiba no `check` de 120 do banco.
 *
 * `contatos.nome` (migration 0003) vai até 120 caracteres, então "Nome
 * respondeu" sozinho já pode passar de 120 — sem truncar aqui o insert
 * falharia em produção com 23514. `disparos.nome` (60) e `instances.nome`
 * (40) nunca chegam perto do limite, então só o ramo de mensagem precisa
 * disto.
 */
function truncarTitulo(quem: string, sufixo: string): string {
  const titulo = `${quem} ${sufixo}`
  if (titulo.length <= LIMITE_TITULO) return titulo

  const limiteQuem = LIMITE_TITULO - sufixo.length - 2 // reticências + espaço
  return `${quem.slice(0, limiteQuem)}… ${sufixo}`
}

/**
 * Traduz um evento do sistema em notificação.
 *
 * Função pura de propósito: é aqui que mora todo o texto que o usuário lê, e
 * dá para testá-la sem banco nem webhook.
 */
export function montarNotificacao(evento: EventoNotificavel): NotificacaoMontada {
  if (evento.tipo === 'mensagem') {
    // Chave canônica: o WhatsApp devolve o número brasileiro sem o nono
    // dígito, e sem isto a mesma pessoa geraria duas notificações.
    const numero = chaveDoNumero(evento.numero)
    return {
      tipo: 'mensagem',
      chave: `mensagem:${numero}`,
      titulo: truncarTitulo(evento.nome ?? numero, 'respondeu'),
      corpo: encurtar(evento.texto),
      // Leva direto para a thread do contato — a Task 3 deu à conversa uma
      // tela própria, então não precisa mais abrir a lista e filtrar.
      destino: `/mensagens/${numero}`,
    }
  }

  if (evento.tipo === 'disparo') {
    return {
      tipo: 'disparo',
      chave: `disparo:${evento.id}`,
      titulo: `${evento.nome} concluída`,
      corpo: `${evento.enviados.toLocaleString('pt-BR')} de ${evento.total.toLocaleString('pt-BR')} enviadas`,
      destino: '/disparos',
    }
  }

  return {
    tipo: 'conexao',
    chave: `conexao:${evento.id}`,
    titulo: `${evento.nome} desconectou`,
    corpo: 'Leia o QR code para reconectar.',
    destino: '/conexao',
  }
}

/**
 * Se uma mudança de estado merece avisar que a conexão caiu.
 *
 * A condição de vir de conectada existe porque toda instância nasce fechada:
 * sem ela, criar uma conexão avisaria queda antes de o QR ser lido.
 */
export function deveNotificarQueda(
  estadoAnterior: string,
  estadoNovo: string,
): boolean {
  return estadoAnterior === 'conectada' && estadoNovo === 'close'
}

/**
 * Chaves de notificação que perderam o objeto ao remover uma conexão.
 *
 * A 0011 pôs `on delete cascade` em `mensagens.instance_id`: tirando a
 * conexão, as conversas dela vão junto. `notificacoes` não tem FK para
 * `instances` e sobrevivia — o sino ficava com "Fulano respondeu" apontando
 * para uma conversa que a tela de Mensagens não mostra mais, sem nenhum jeito
 * de o usuário se livrar do aviso.
 *
 * `numerosRemanescentes` é o que sobrou do dono depois do cascade: com duas
 * conexões, o mesmo contato pode ter conversa nas duas, e a notificação dele
 * ainda tem para onde levar. A comparação passa pela forma canônica dos dois
 * lados porque o disparo grava com o nono dígito e o webhook sem ele.
 */
export function chavesOrfas({
  instanceId,
  numerosDaConexao,
  numerosRemanescentes,
}: {
  instanceId: string
  numerosDaConexao: string[]
  numerosRemanescentes: string[]
}): string[] {
  const sobrou = new Set(numerosRemanescentes.map(chaveDoNumero))

  // A queda da conexão removida também não tem mais destino.
  const chaves = new Set<string>([`conexao:${instanceId}`])

  for (const numero of numerosDaConexao) {
    const canonico = chaveDoNumero(numero)
    if (!sobrou.has(canonico)) chaves.add(`mensagem:${canonico}`)
  }

  return [...chaves]
}
