/** Conjunto fechado de cores; espelha o enum public.etiqueta_cor. */
export const CORES_ETIQUETA = [
  'verde',
  'azul',
  'ambar',
  'roxo',
  'rosa',
  'cinza',
] as const

export type CorEtiqueta = (typeof CORES_ETIQUETA)[number]

export type Etiqueta = {
  id: string
  nome: string
  cor: CorEtiqueta
}

export const LIMITE_NOME_ETIQUETA = 24

/** Classes do selo por cor. Chave fechada evita CSS vindo do formulário. */
export const ESTILO_ETIQUETA: Record<CorEtiqueta, string> = {
  verde: 'bg-primary/15 text-primary',
  azul: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  ambar: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  roxo: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  rosa: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
  cinza: 'bg-muted text-muted-foreground',
}

export const ROTULO_COR: Record<CorEtiqueta, string> = {
  verde: 'Verde',
  azul: 'Azul',
  ambar: 'Âmbar',
  roxo: 'Roxo',
  rosa: 'Rosa',
  cinza: 'Cinza',
}

export function ehCorValida(valor: string): valor is CorEtiqueta {
  return (CORES_ETIQUETA as readonly string[]).includes(valor)
}

/** Cor de exibição das etiquetas dos dados de exemplo. */
export const COR_EXEMPLO: Record<string, CorEtiqueta> = {
  VIP: 'verde',
  Cliente: 'azul',
  Lead: 'ambar',
  Inativo: 'cinza',
}
