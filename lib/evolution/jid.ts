/**
 * Extração do número a partir do endereço que o WhatsApp usa.
 *
 * Há dois formatos em circulação. O antigo traz o telefone direto
 * (`5511999999999@s.whatsapp.net`). O novo, chamado LID, traz um
 * identificador opaco (`...@lid`) e manda o telefone à parte, em
 * `remoteJidAlt` — foi o que apareceu no log da Evolution, com
 * `addressingMode: 'lid'`.
 *
 * Aceitar só o formato antigo faria a mensagem sumir sem aviso à medida que o
 * WhatsApp for migrando.
 */
export type ChaveMensagem = {
  remoteJid?: string
  remoteJidAlt?: string
  fromMe?: boolean
}

/** Endereços que não são conversa com um contato. */
const NAO_E_CONTATO = ['@g.us', '@broadcast', '@newsletter']

export function ehConversaDeContato(jid: string): boolean {
  return !NAO_E_CONTATO.some((sufixo) => jid.endsWith(sufixo))
}

/**
 * Número do contato, ou null quando o endereço não é de conversa individual.
 *
 * O telefone tem preferência sobre o LID: é ele que casa com o cadastro de
 * contatos e com o que o disparo gravou.
 */
export function numeroDoContato(chave: ChaveMensagem | null): string | null {
  if (!chave) return null

  const enderecos = [chave.remoteJidAlt, chave.remoteJid]
    .filter((j): j is string => Boolean(j))
    .map(String)
    .filter(ehConversaDeContato)

  const telefone = enderecos.find((j) => j.endsWith('@s.whatsapp.net'))
  if (telefone) return telefone.split('@')[0]

  // Sem telefone, o LID ainda identifica a conversa. Melhor registrar por ele
  // do que perder a mensagem.
  const lid = enderecos.find((j) => j.endsWith('@lid'))
  if (lid) return lid.split('@')[0]

  return null
}
