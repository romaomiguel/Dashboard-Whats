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
