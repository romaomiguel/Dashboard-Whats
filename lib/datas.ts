/**
 * Formatação de data com fuso fixo.
 *
 * Sem `timeZone`, o servidor (UTC na Vercel) e o navegador (fuso de quem
 * acessa) produzem textos diferentes para o mesmo instante, e o React acusa
 * divergência na hidratação — o erro #418. Fixar o fuso faz os dois lados
 * escreverem a mesma coisa.
 */
const FUSO = 'America/Sao_Paulo'

export function formatarDataHora(iso: string): string {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return iso

  return data.toLocaleString('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatarData(iso: string): string {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return iso

  return data.toLocaleDateString('pt-BR', { timeZone: FUSO })
}

export function formatarHora(iso: string): string {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return iso

  return data.toLocaleTimeString('pt-BR', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Acima disto a distância deixa de ajudar e a data absoluta informa mais. */
const DIAS_RELATIVOS = 7

/**
 * "há 5 min" em vez de "20/08, 14:32".
 *
 * Recebe `agora` em vez de chamar `Date.now()` por dentro para poder ser
 * testada sem congelar o relógio, e cai na data absoluta a partir de uma
 * semana: "há 34 d" obriga o leitor a fazer a conta que a data já entrega.
 *
 * O painel do sino só é montado quando abre, depois da hidratação, então
 * este texto nunca entra no HTML do servidor e não repete o #418 que o
 * `toLocaleString` sem fuso causou.
 */
export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return iso

  const segundos = Math.floor((agora.getTime() - data.getTime()) / 1000)

  // Relógio do navegador atrasado em relação ao do banco dá diferença
  // negativa; "há -1 min" seria pior que arredondar para agora.
  if (segundos < 60) return 'agora'

  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return `há ${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`

  const dias = Math.floor(horas / 24)
  if (dias < DIAS_RELATIVOS) return `há ${dias} d`

  return formatarData(iso)
}
