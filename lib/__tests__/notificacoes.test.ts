import { describe, expect, it } from 'vitest'
import { montarNotificacao, PREFERENCIA_POR_TIPO } from '@/lib/notificacoes'

describe('montarNotificacao — mensagem', () => {
  it('agrupa pela forma canônica do número, sem o nono dígito', () => {
    const n = montarNotificacao({
      tipo: 'mensagem',
      numero: '5565984627628',
      nome: 'Amanda',
      texto: 'Oi, tudo bem?',
    })
    expect(n.chave).toBe('mensagem:556584627628')
  })

  it('a mesma pessoa nas duas formas dá a mesma chave', () => {
    const comNove = montarNotificacao({
      tipo: 'mensagem',
      numero: '5565984627628',
      nome: 'Amanda',
      texto: 'a',
    })
    const semNove = montarNotificacao({
      tipo: 'mensagem',
      numero: '556584627628',
      nome: 'Amanda',
      texto: 'b',
    })
    expect(comNove.chave).toBe(semNove.chave)
  })

  it('usa o nome no título e o texto no corpo', () => {
    const n = montarNotificacao({
      tipo: 'mensagem',
      numero: '556584627628',
      nome: 'Amanda',
      texto: 'Oi, tudo bem?',
    })
    expect(n.titulo).toBe('Amanda respondeu')
    expect(n.corpo).toBe('Oi, tudo bem?')
  })

  it('sem nome, identifica pelo número', () => {
    const n = montarNotificacao({
      tipo: 'mensagem',
      numero: '556584627628',
      nome: null,
      texto: 'Oi',
    })
    expect(n.titulo).toBe('556584627628 respondeu')
  })

  it('corta corpo longo, para o painel não virar parede de texto', () => {
    const textoOriginal = 'a'.repeat(200)
    const n = montarNotificacao({
      tipo: 'mensagem',
      numero: '556584627628',
      nome: 'Amanda',
      texto: textoOriginal,
    })
    // Não basta caber em 120: precisa preservar o começo do texto original
    // (senão string vazia ou texto fixo também passaria) e marcar o corte.
    expect(n.corpo!.length).toBeLessThanOrEqual(120)
    expect(n.corpo!.startsWith(textoOriginal.slice(0, 50))).toBe(true)
    expect(n.corpo).toMatch(/…$/)
  })

  it('nome de contato no limite de 120 não estoura o título', () => {
    // contatos.nome (migration 0003) vai até 120 — "Nome respondeu" sozinho
    // já passaria do check de 120 em notificacoes (migration 0012).
    const nomeLongo = 'Amanda'.repeat(20) // 120 caracteres
    const n = montarNotificacao({
      tipo: 'mensagem',
      numero: '556584627628',
      nome: nomeLongo,
      texto: 'Oi',
    })
    expect(n.titulo.length).toBeLessThanOrEqual(120)
    expect(n.titulo.startsWith(nomeLongo.slice(0, 30))).toBe(true)
    expect(n.titulo).toMatch(/… respondeu$/)
  })

  it('leva o número na busca do destino', () => {
    const n = montarNotificacao({
      tipo: 'mensagem',
      numero: '556584627628',
      nome: 'Amanda',
      texto: 'Oi',
    })
    expect(n.destino).toBe('/mensagens?busca=556584627628')
  })
})

describe('montarNotificacao — disparo', () => {
  it('resume entregues sobre total', () => {
    const n = montarNotificacao({
      tipo: 'disparo',
      id: 'd1',
      nome: 'Promoção Black Friday',
      enviados: 287,
      total: 300,
    })
    expect(n.chave).toBe('disparo:d1')
    expect(n.titulo).toBe('Promoção Black Friday concluída')
    expect(n.corpo).toBe('287 de 300 enviadas')
    expect(n.destino).toBe('/disparos')
  })
})

describe('montarNotificacao — conexao', () => {
  it('nomeia a conexão que caiu', () => {
    const n = montarNotificacao({
      tipo: 'conexao',
      id: 'c1',
      nome: 'Comercial 01',
    })
    expect(n.chave).toBe('conexao:c1')
    expect(n.titulo).toBe('Comercial 01 desconectou')
    expect(n.corpo).toBe('Leia o QR code para reconectar.')
    expect(n.destino).toBe('/conexao')
  })
})

describe('PREFERENCIA_POR_TIPO', () => {
  it('liga cada tipo à sua coluna em profiles', () => {
    expect(PREFERENCIA_POR_TIPO.mensagem).toBe('notificar_mensagem')
    expect(PREFERENCIA_POR_TIPO.disparo).toBe('notificar_disparo')
    expect(PREFERENCIA_POR_TIPO.conexao).toBe('notificar_conexao')
  })
})
