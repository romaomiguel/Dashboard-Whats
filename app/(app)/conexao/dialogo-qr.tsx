'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, QrCode, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { atualizarQr, verificarConexao } from './actions'

/** O QR do WhatsApp vence em cerca de um minuto. */
const INTERVALO_QR_MS = 50_000
const INTERVALO_ESTADO_MS = 5_000

export function DialogoQr({
  id,
  nome,
  qrInicial = '',
  aberto,
  aoFechar,
}: {
  id: string
  nome: string
  qrInicial?: string
  aberto: boolean
  aoFechar: () => void
}) {
  const router = useRouter()
  const [qr, setQr] = useState(qrInicial)
  const [erro, setErro] = useState('')
  const [conectou, setConectou] = useState(false)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  useEffect(() => {
    if (aberto) {
      setQr(qrInicial)
      setErro('')
      setConectou(false)
    }
  }, [aberto, qrInicial])

  const pedirQr = useCallback(async () => {
    const resultado = await atualizarQr(id)
    if (!montado.current) return
    if (resultado.erro) setErro(resultado.erro)
    else if (resultado.qr) setQr(resultado.qr)
  }, [id])

  // Dois relógios enquanto o diálogo está aberto: um renova o código antes de
  // vencer, outro pergunta à Evolution se o telefone já leu. O webhook não
  // resolve isso em desenvolvimento — a Evolution não alcança o localhost.
  useEffect(() => {
    if (!aberto || conectou) return

    if (!qr) void pedirQr()

    const renovaQr = setInterval(() => void pedirQr(), INTERVALO_QR_MS)
    const checaEstado = setInterval(async () => {
      const resultado = await verificarConexao(id)
      if (!montado.current) return
      if (resultado.status === 'conectada') {
        setConectou(true)
        router.refresh()
      }
    }, INTERVALO_ESTADO_MS)

    return () => {
      clearInterval(renovaQr)
      clearInterval(checaEstado)
    }
  }, [aberto, conectou, qr, id, pedirQr, router])

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar {nome}</DialogTitle>
          <DialogDescription>
            Abra o WhatsApp {'>'} Aparelhos conectados {'>'} Conectar aparelho e
            aponte a câmera para o código.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {conectou ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CheckCircle2 className="size-12 text-primary" />
              <p className="text-sm font-medium text-foreground">
                WhatsApp conectado
              </p>
            </div>
          ) : (
            <>
              <div className="flex size-64 items-center justify-center rounded-lg border border-dashed border-border bg-background p-2">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qr}
                    alt={`QR code para conectar ${nome}`}
                    className="size-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <QrCode className="size-16" strokeWidth={1} />
                    <Loader2 className="size-4 animate-spin" />
                  </div>
                )}
              </div>

              <p className="text-center text-xs text-muted-foreground">
                O código se renova sozinho antes de vencer.
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

          {erro && (
            <p role="alert" className="text-center text-sm text-destructive">
              {erro}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar}>
            {conectou ? 'Fechar' : 'Cancelar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
