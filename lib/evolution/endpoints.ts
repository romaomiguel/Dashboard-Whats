/**
 * Todos os caminhos da Evolution API em um só lugar.
 *
 * A documentação do Evolution Foundation não publica referência
 * endpoint-a-endpoint; estes seguem as convenções da v2 e são confirmados
 * contra a instância real na Task 10. Divergindo, ajustar SÓ este arquivo.
 */
const esc = encodeURIComponent

export const endpoints = {
  instancia: {
    criar: () => '/instance/create',
    conectar: (nome: string) => `/instance/connect/${esc(nome)}`,
    estado: (nome: string) => `/instance/connectionState/${esc(nome)}`,
    listar: () => '/instance/fetchInstances',
    logout: (nome: string) => `/instance/logout/${esc(nome)}`,
    deletar: (nome: string) => `/instance/delete/${esc(nome)}`,
  },
  webhook: {
    definir: (nome: string) => `/webhook/set/${esc(nome)}`,
    buscar: (nome: string) => `/webhook/find/${esc(nome)}`,
  },
  mensagem: {
    texto: (nome: string) => `/message/sendText/${esc(nome)}`,
    midia: (nome: string) => `/message/sendMedia/${esc(nome)}`,
  },
  chat: {
    contatos: (nome: string) => `/chat/findContacts/${esc(nome)}`,
    conversas: (nome: string) => `/chat/findChats/${esc(nome)}`,
    mensagens: (nome: string) => `/chat/findMessages/${esc(nome)}`,
  },
} as const
