/** O recorte do evento do dnd-kit que a decisão precisa. */
export type EventoDeArraste = {
  active: { id: string | number; data?: { etapaId?: string | null } }
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
