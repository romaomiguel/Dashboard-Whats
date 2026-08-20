export const summary = {
  contatos: 4820,
  mensagens: 128,
  conexoesAtivas: 3,
  conexoesTotal: 4,
  disparosHoje: 1240,
  taxaEntrega: 96,
  taxaLeitura: 78,
  taxaResposta: 41,
}

// Mensagens enviadas x recebidas por dia da semana (gráfico de barras)
export const weeklyMessages = [
  { dia: 'Seg', enviadas: 820, recebidas: 540 },
  { dia: 'Ter', enviadas: 932, recebidas: 610 },
  { dia: 'Qua', enviadas: 1010, recebidas: 720 },
  { dia: 'Qui', enviadas: 870, recebidas: 690 },
  { dia: 'Sex', enviadas: 1240, recebidas: 880 },
  { dia: 'Sáb', enviadas: 640, recebidas: 410 },
  { dia: 'Dom', enviadas: 380, recebidas: 260 },
]

// Escala de desempenho dos disparos (gráfico radial / escala)
export const deliveryScale = [
  { etapa: 'Entregues', valor: 96, fill: 'var(--color-entregues)' },
  { etapa: 'Lidas', valor: 78, fill: 'var(--color-lidas)' },
  { etapa: 'Respondidas', valor: 41, fill: 'var(--color-respondidas)' },
]

export type Conexao = {
  nome: string
  numero: string
  status: 'online' | 'offline' | 'conectando'
  bateria: number
}

export const conexoes: Conexao[] = [
  { nome: 'Comercial 01', numero: '+55 11 98888-1010', status: 'online', bateria: 87 },
  { nome: 'Suporte', numero: '+55 11 97777-2020', status: 'online', bateria: 64 },
  { nome: 'Financeiro', numero: '+55 11 96666-3030', status: 'conectando', bateria: 42 },
  { nome: 'Marketing', numero: '+55 11 95555-4040', status: 'offline', bateria: 0 },
]

export type Mensagem = {
  contato: string
  numero: string
  previa: string
  hora: string
  naoLidas: number
  status: 'entregue' | 'lida' | 'respondida'
}

export const mensagensRecentes: Mensagem[] = [
  {
    contato: 'Lívia Torri',
    numero: '+55 11 91234-5678',
    previa: 'Perfeito, pode confirmar o pedido!',
    hora: '09:42',
    naoLidas: 2,
    status: 'respondida',
  },
  {
    contato: 'Miro Baptista',
    numero: '+55 21 99876-5432',
    previa: 'Recebi a proposta, vou analisar.',
    hora: '09:31',
    naoLidas: 0,
    status: 'lida',
  },
  {
    contato: 'Helena Duarte',
    numero: '+55 31 98765-1122',
    previa: 'Qual o prazo de entrega?',
    hora: '09:18',
    naoLidas: 1,
    status: 'entregue',
  },
  {
    contato: 'Rafael Nunes',
    numero: '+55 41 97654-3210',
    previa: 'Obrigado pelo atendimento :)',
    hora: '08:57',
    naoLidas: 0,
    status: 'respondida',
  },
  {
    contato: 'Camila Rocha',
    numero: '+55 51 96543-2109',
    previa: 'Boa tarde, gostaria de um orçamento.',
    hora: '08:40',
    naoLidas: 3,
    status: 'entregue',
  },
]

export type Contato = {
  nome: string
  numero: string
  tag: 'Cliente' | 'Lead' | 'VIP' | 'Inativo'
  ultimaInteracao: string
}

export const contatos: Contato[] = [
  { nome: 'Lívia Torri', numero: '+55 11 91234-5678', tag: 'VIP', ultimaInteracao: 'Hoje, 09:42' },
  { nome: 'Miro Baptista', numero: '+55 21 99876-5432', tag: 'Cliente', ultimaInteracao: 'Hoje, 09:31' },
  { nome: 'Helena Duarte', numero: '+55 31 98765-1122', tag: 'Lead', ultimaInteracao: 'Hoje, 09:18' },
  { nome: 'Rafael Nunes', numero: '+55 41 97654-3210', tag: 'Cliente', ultimaInteracao: 'Ontem, 18:04' },
  { nome: 'Camila Rocha', numero: '+55 51 96543-2109', tag: 'Lead', ultimaInteracao: 'Ontem, 15:22' },
  { nome: 'Bruno Alves', numero: '+55 61 95432-1098', tag: 'Inativo', ultimaInteracao: '3 dias atrás' },
  { nome: 'Sofia Martins', numero: '+55 71 94321-0987', tag: 'VIP', ultimaInteracao: '4 dias atrás' },
  { nome: 'Diego Ferraz', numero: '+55 81 93210-9876', tag: 'Cliente', ultimaInteracao: '1 semana atrás' },
]

export type Midia = {
  nome: string
  tipo: 'imagem' | 'video' | 'documento' | 'audio'
  tamanho: string
  data: string
}

export const midias: Midia[] = [
  { nome: 'promo-black-friday.jpg', tipo: 'imagem', tamanho: '1.2 MB', data: '19 ago 2026' },
  { nome: 'catalogo-2026.pdf', tipo: 'documento', tamanho: '3.8 MB', data: '18 ago 2026' },
  { nome: 'demonstracao-produto.mp4', tipo: 'video', tamanho: '12.4 MB', data: '17 ago 2026' },
  { nome: 'audio-boas-vindas.ogg', tipo: 'audio', tamanho: '640 KB', data: '16 ago 2026' },
  { nome: 'banner-lancamento.png', tipo: 'imagem', tamanho: '890 KB', data: '15 ago 2026' },
  { nome: 'tabela-precos.pdf', tipo: 'documento', tamanho: '512 KB', data: '14 ago 2026' },
]

export type Disparo = {
  nome: string
  status: 'enviando' | 'agendado' | 'concluido' | 'rascunho'
  total: number
  entregues: number
  data: string
}

export const disparos: Disparo[] = [
  { nome: 'Promoção Black Friday', status: 'enviando', total: 3200, entregues: 1840, data: 'Hoje, 10:00' },
  { nome: 'Reengajamento inativos', status: 'agendado', total: 1500, entregues: 0, data: 'Amanhã, 08:00' },
  { nome: 'Confirmação de pedidos', status: 'concluido', total: 980, entregues: 962, data: 'Ontem, 14:30' },
  { nome: 'Novidades do catálogo', status: 'concluido', total: 2400, entregues: 2311, data: '2 dias atrás' },
  { nome: 'Pesquisa de satisfação', status: 'rascunho', total: 0, entregues: 0, data: '—' },
]
