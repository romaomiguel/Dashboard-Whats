/**
 * Todos os caminhos da Evolution API em um só lugar.
 *
 * A documentação do Evolution Foundation não publica referência
 * endpoint-a-endpoint; estes seguem as convenções da v2 e são confirmados
 * contra a instância real na Task 10. Divergindo, ajustar SÓ este arquivo.
 */
import { validarNomeInstancia } from './nome-instancia'

const esc = encodeURIComponent

export const endpoints = {
  instancia: {
    criar: () => '/instance/create',
    conectar: (nome: string) => `/instance/connect/${esc(validarNomeInstancia(nome))}`,
    estado: (nome: string) => `/instance/connectionState/${esc(validarNomeInstancia(nome))}`,
    listar: () => '/instance/fetchInstances',
    logout: (nome: string) => `/instance/logout/${esc(validarNomeInstancia(nome))}`,
    deletar: (nome: string) => `/instance/delete/${esc(validarNomeInstancia(nome))}`,
  },
  webhook: {
    definir: (nome: string) => `/webhook/set/${esc(validarNomeInstancia(nome))}`,
    buscar: (nome: string) => `/webhook/find/${esc(validarNomeInstancia(nome))}`,
  },
  mensagem: {
    texto: (nome: string) => `/message/sendText/${esc(validarNomeInstancia(nome))}`,
    midia: (nome: string) => `/message/sendMedia/${esc(validarNomeInstancia(nome))}`,
  },
  chat: {
    contatos: (nome: string) => `/chat/findContacts/${esc(validarNomeInstancia(nome))}`,
    conversas: (nome: string) => `/chat/findChats/${esc(validarNomeInstancia(nome))}`,
    mensagens: (nome: string) => `/chat/findMessages/${esc(validarNomeInstancia(nome))}`,
  },
} as const
