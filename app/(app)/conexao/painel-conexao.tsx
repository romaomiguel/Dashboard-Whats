'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  Plug,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { EstadoVazio } from '@/components/estado-vazio'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Conexao, StatusConexao } from '@/lib/consultas/conexao'
import {
  atualizarQr,
  criarConexao,
  removerConexao,
  verificarConexao,
} from './actions'

const ESTILO_STATUS: Record<StatusConexao, string> = {
  conectada: 'bg-primary/15 text-primary',
  conectando: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  criada: 'bg-muted text-muted-foreground',
  desconectada: 'bg-muted text-muted-foreground',
}

const ROTULO_STATUS: Record<StatusConexao, string> = {
  conectada: 'Conectada',
  conectando: 'Aguardando leitura',
  criada: 'Criada',
  desconectada: 'Desconectada',
}

/** O QR do WhatsApp vence em cerca de um minuto. */
const INTERVALO_QR_MS = 50_000
const INTERVALO_ESTADO_MS = 5_000

export function PainelConexao({ conexao }: { conexao: Conexao | null }) {
  const router = useRouter()
  const [qr, setQr] = useState('')
  const [erro, setErro] = useState('')
  const [criando, setCriando] = useState(false)
  const [removendo, setRemovendo] = useState(false)
  const [status, setStatus] = useState<StatusConexao | null>(
    conexao?.status ?? null,
  )
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  useEffect(() => {
    setStatus(conexao?.status ?? null)
  }, [conexao])

  const aguardandoLeitura =
    Boolean(conexao) && status !== 'conectada' && status !== null

  const pedirQr = useCallback(async () => {
    const resultado = await atualizarQr()
    if (!montado.current) return
    if (resultado.erro) setErro(resultado.erro)
    else if (resultado.qr) setQr(resultado.qr)
  }, [])

  // Enquanto o QR está na tela, dois relógios: um renova o código antes de
  // vencer, outro pergunta à Evolution se o telefone já leu. O webhook não
  // resolve isso em desenvolvimento — a Evolution não alcança o localhost.
  useEffect(() => {
    if (!aguardandoLeitura) return

    if (!qr) void pedirQr()

    const renovaQr = setInterval(() => void pedirQr(), INTERVALO_QR_MS)
    const checaEstado = setInterval(async () => {
      const resultado = await verificarConexao()
      if (!montado.current) return
      if (resultado.status) {
        setStatus(resultado.status)
        if (resultado.status === 'conectada') router.refresh()
      }
    }, INTERVALO_ESTADO_MS)

    return () => {
      clearInterval(renovaQr)
      clearInterval(checaEstado)
    }
  }, [aguardandoLeitura, qr, pedirQr, router])

  async function criar() {
    setErro('')
    setCriando(true)
    try {
      const resultado = await criarConexao()
      if (resultado.erro) {
        setErro(resultado.erro)
        return
      }
      if (resultado.qr) setQr(resultado.qr)
      setStatus(resultado.status ?? 'conectando')
      router.refresh()
    } finally {
      if (montado.current) setCriando(false)
    }
  }

  async function remover() {
    setErro('')
    setRemovendo(true)
    try {
      const resultado = await removerConexao()
      if (resultado.erro) {
        setErro(resultado.erro)
        return
      }
      setQr('')
      setStatus(null)
      router.refresh()
    } finally {
      if (montado.current) setRemovendo(false)
    }
  }

  if (!conexao) {
    return (
      <>
        {erro && (
          <p role="alert" className="text-sm text-destructive">
            {erro}
          </p>
        )}

        <Card>
          <EstadoVazio
            icone={Smartphone}
            titulo="Nenhuma conexão"
            descricao="Crie uma instância e leia o QR code no WhatsApp para conectar."
          />
          <div className="flex flex-col items-center gap-2 pb-8">
            <Button className="gap-2" onClick={criar} disabled={criando}>
              {criando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plug className="size-4" />
              )}
              {criando ? 'Criando...' : 'Conectar WhatsApp'}
            </Button>
            {criando && (
              <p className="max-w-xs text-center text-xs text-muted-foreground">
                A Evolution hiberna no plano free do Render. Se estiver
                dormindo, acordar leva até 90 segundos.
              </p>
            )}
          </div>
        </Card>
      </>
    )
  }

  return (
    <>
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Minha conexão</CardTitle>
            <p className="font-mono text-xs text-muted-foreground">
              {conexao.nomeEvolution}
            </p>
          </div>
          <Badge className={ESTILO_STATUS[status ?? conexao.status]}>
            {ROTULO_STATUS[status ?? conexao.status]}
          </Badge>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-4">
          {status === 'conectada' ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Smartphone className="size-6" />
              </div>
              <p className="text-sm font-medium text-foreground">
                WhatsApp conectado
              </p>
              {conexao.numero && (
                <p className="font-mono text-sm text-muted-foreground">
                  {conexao.numero}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex size-64 items-center justify-center rounded-lg border border-dashed border-border bg-background p-2">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qr}
                    alt="QR code para conectar o WhatsApp"
                    className="size-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <QrCode className="size-16" strokeWidth={1} />
                    <Loader2 className="size-4 animate-spin" />
                  </div>
                )}
              </div>

              <p className="max-w-xs text-center text-xs text-muted-foreground">
                Abra o WhatsApp {'>'} Aparelhos conectados {'>'} Conectar
                aparelho e aponte a câmera para o código. Ele se renova sozinho
                antes de vencer.
              </p>

              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void pedirQr()}
              >
                <RefreshCw className="size-4" />
                Gerar novo código
              </Button>
            </>
          )}

          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={remover}
            disabled={removendo}
          >
            {removendo ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {removendo ? 'Removendo...' : 'Remover conexão'}
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
