/** Estado da conexão devolvido por /instance/connectionState. */
export type EstadoConexao = 'open' | 'connecting' | 'close'

export type RespostaEstadoConexao = {
  instance: { instanceName: string; state: EstadoConexao }
}

export type RespostaCriarInstancia = {
  instance: { instanceName: string; instanceId?: string; status?: string }
  hash?: string | { apikey?: string }
  qrcode?: { base64?: string; code?: string }
}

export type RespostaConectar = {
  base64?: string
  code?: string
  pairingCode?: string | null
}

export type EventoWebhook = {
  event: string
  instance: string
  data: unknown
  date_time?: string
  sender?: string
}
