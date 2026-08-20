/**
 * Tipos e rótulos das conexões — sem nada de servidor.
 *
 * Separado de lib/consultas/conexao.ts de propósito: aquele importa o cliente
 * do Supabase de servidor, e um componente de cliente que precisasse só do
 * rótulo arrastaria `server-only` para o navegador junto.
 */
export const STATUS_CONEXAO = [
  'criada',
  'conectando',
  'conectada',
  'desconectada',
] as const

export type StatusConexao = (typeof STATUS_CONEXAO)[number]

export const LIMITE_NOME_CONEXAO = 40

export type Conexao = {
  id: string
  nome: string
  nomeEvolution: string
  numero: string | null
  status: StatusConexao
  atualizadoEm: string
}

/** Os três rótulos que a tela mostra, do ponto de vista de quem usa. */
export const ROTULO_STATUS: Record<StatusConexao, string> = {
  conectada: 'Conectado',
  conectando: 'Reconectando',
  criada: 'Reconectando',
  desconectada: 'Desconectado',
}

export const ESTILO_STATUS: Record<StatusConexao, string> = {
  conectada: 'bg-primary/15 text-primary',
  conectando: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  criada: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  desconectada: 'bg-muted text-muted-foreground',
}

export function ehStatusConexao(valor: string): valor is StatusConexao {
  return (STATUS_CONEXAO as readonly string[]).includes(valor)
}
