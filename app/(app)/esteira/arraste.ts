/** O recorte do evento do dnd-kit que a decisão precisa. */
export type EventoDeArraste = {
  active: { id: string | number; data?: { etapaId?: string | null } }
  over: { id: string | number } | null
}

/**
 * O evento como o dnd-kit realmente entrega.
 *
 * `active.data` é um ref (`MutableRefObject`), não um objeto simples, e
 * `over.id` pode ser tanto a coluna quanto outro card — os itens do
 * `SortableContext` também são alvos de soltura. Modelar isso aqui é o que
 * permite testar as duas traduções sem o React em volta.
 */
export type EventoDeSoltura = {
  active: { id: string | number; data?: { current?: { etapaId?: string | null } } }
  over: { id: string | number } | null
}

/**
 * O que fazer quando o card é solto.
 *
 * Fica fora do componente porque arrastar não é testável de forma honesta
 * em jsdom: aqui a regra é verificável, e o componente só a obedece.
 */
export function resolverArraste(
  evento: EventoDeArraste,
): { funilId: string; etapaId: string } | null {
  if (!evento.over) return null

  const etapaId = String(evento.over.id)
  if (evento.active.data?.etapaId === etapaId) return null

  return { funilId: String(evento.active.id), etapaId }
}

/**
 * O destino da soltura a partir do evento cru do dnd-kit.
 *
 * Traduz o que o dnd-kit entrega para o que `resolverArraste` decide, e é
 * aqui que mora a parte que erra na prática — por isso não ficou dentro do
 * componente, onde nenhum teste a alcançaria:
 *
 * 1. desembrulha `active.data.current`; lendo a propriedade direto do ref, a
 *    origem seria sempre indefinida e a guarda de mesma coluna nunca
 *    dispararia — cada soltura no lugar de origem viraria ida ao servidor e
 *    uma linha de histórico com `de === para`;
 * 2. traduz `over.id` de card para a etapa dele, senão o destino seria um id
 *    que não existe em `etapas` e o servidor responderia "Etapa não
 *    encontrada";
 * 3. quando o payload do ref não veio, descobre a origem pelas próprias
 *    linhas: a guarda de mesma coluna não pode depender de um dado opcional.
 */
export function resolverDestino(
  evento: EventoDeSoltura,
  etapas: readonly { id: string }[],
  linhas: readonly { id: string; etapaId: string | null }[],
): { funilId: string; etapaId: string } | null {
  if (!evento.over) return null

  const sobre = String(evento.over.id)
  const funilId = String(evento.active.id)

  const etapaDestino = etapas.some((e) => e.id === sobre)
    ? sobre
    : (linhas.find((l) => l.id === sobre)?.etapaId ?? null)

  // Id que não é coluna nem card conhecido: não há destino a inventar.
  if (!etapaDestino) return null

  const origem =
    evento.active.data?.current?.etapaId ??
    linhas.find((l) => l.id === funilId)?.etapaId ??
    null

  return resolverArraste({
    active: { id: funilId, data: { etapaId: origem } },
    over: { id: etapaDestino },
  })
}
