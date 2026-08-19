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
