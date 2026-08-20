import { describe, expect, it } from 'vitest'
import {
  funilDeEntrega,
  inicioDoDia,
  porcentagem,
  volumeDaSemana,
  type LinhaMensagem,
} from '@/lib/resumo'

function msg(sobrepor: Partial<LinhaMensagem> = {}): LinhaMensagem {
  return {
    direcao: 'saida',
    status: 'enviada',
    numero: '5511900000000',
    criado_em: '2026-08-20T12:00:00.000Z',
    ...sobrepor,
  }
}

describe('inicioDoDia', () => {
  // 02:01 em São Paulo ainda é dia 20; o dia começou às 03:00 UTC.
  it('marca a virada do dia em São Paulo, não em UTC', () => {
    const inicio = inicioDoDia(new Date('2026-08-20T05:01:00.000Z'))
    expect(inicio.toISOString()).toBe('2026-08-20T03:00:00.000Z')
  })

  it('01:00 UTC ainda pertence ao dia anterior em São Paulo', () => {
    const inicio = inicioDoDia(new Date('2026-08-20T01:00:00.000Z'))
    expect(inicio.toISOString()).toBe('2026-08-19T03:00:00.000Z')
  })

  it('anda para trás em dias inteiros', () => {
    const inicio = inicioDoDia(new Date('2026-08-20T12:00:00.000Z'), 6)
    expect(inicio.toISOString()).toBe('2026-08-14T03:00:00.000Z')
  })
})

describe('volumeDaSemana', () => {
  const agora = new Date('2026-08-20T12:00:00.000Z')

  it('devolve sempre sete dias, mesmo sem mensagem', () => {
    const semana = volumeDaSemana([], agora)
    expect(semana).toHaveLength(7)
    expect(semana.every((d) => d.enviadas === 0 && d.recebidas === 0)).toBe(true)
  })

  it('separa enviadas de recebidas no dia certo', () => {
    const semana = volumeDaSemana(
      [
        msg({ direcao: 'saida' }),
        msg({ direcao: 'saida' }),
        msg({ direcao: 'entrada' }),
      ],
      agora,
    )

    expect(semana[6]).toMatchObject({ enviadas: 2, recebidas: 1 })
  })

  it('mensagem mais velha que a janela fica de fora', () => {
    const semana = volumeDaSemana(
      [msg({ criado_em: '2026-07-01T12:00:00.000Z' })],
      agora,
    )
    expect(semana.every((d) => d.enviadas === 0)).toBe(true)
  })

  it('rotula o último dia como o dia da semana de hoje', () => {
    // 2026-08-20 é uma quinta-feira.
    expect(volumeDaSemana([], agora)[6].dia).toBe('Qui')
  })
})

describe('funilDeEntrega', () => {
  it('sem recibo, "entregues" reflete o que a API aceitou', () => {
    // Instância sem webhook nunca receberia confirmação; zerar o funil
    // passaria a impressão errada de que nada saiu.
    const funil = funilDeEntrega([msg(), msg(), msg({ status: 'falhou' })])
    expect(funil[0]).toMatchObject({ etapa: 'Entregues', valor: 67 })
  })

  it('havendo recibo, ele manda', () => {
    const funil = funilDeEntrega([
      msg({ status: 'entregue' }),
      msg({ status: 'lida' }),
      msg({ status: 'enviada' }),
      msg({ status: 'enviada' }),
    ])
    expect(funil[0].valor).toBe(50)
    expect(funil[1]).toMatchObject({ etapa: 'Lidas', valor: 25 })
  })

  it('respondidas conta contatos, não mensagens', () => {
    const funil = funilDeEntrega([
      msg({ numero: 'a' }),
      msg({ numero: 'b' }),
      msg({ numero: 'a', direcao: 'entrada', status: 'recebida' }),
      msg({ numero: 'a', direcao: 'entrada', status: 'recebida' }),
    ])
    // Um dos dois alcançados respondeu, ainda que duas vezes.
    expect(funil[2]).toMatchObject({ etapa: 'Respondidas', valor: 50 })
  })

  it('quem responde sem ter recebido nada não entra na conta', () => {
    const funil = funilDeEntrega([
      msg({ numero: 'a' }),
      msg({ numero: 'z', direcao: 'entrada', status: 'recebida' }),
    ])
    expect(funil[2].valor).toBe(0)
  })

  it('sem envio nenhum, tudo zero em vez de dividir por zero', () => {
    expect(funilDeEntrega([]).every((e) => e.valor === 0)).toBe(true)
  })
})

describe('porcentagem', () => {
  it('multiplica antes de dividir', () => {
    expect(porcentagem(1840, 3200)).toBe(58)
  })

  it('todo zero devolve zero', () => {
    expect(porcentagem(5, 0)).toBe(0)
  })
})
