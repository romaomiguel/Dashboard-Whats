'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { enviarMensagem } from '@/app/(app)/mensagens/actions'
import { Button } from '@/components/ui/button'
import { formatarDataHora } from '@/lib/datas'
import type { MensagemDaConversa } from '@/lib/consultas/conversa'
import { criarClienteNavegador } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

/** Junta os eventos de uma rajada num só refresh, como o sino já faz. */
const ATRASO_REFRESH_MS = 700

export function Thread({
  numero,
  nome,
  iniciais,
}: {
  numero: string
  nome: string
  iniciais: MensagemDaConversa[]
}) {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Realtime: mensagem nova do contato entra sem recarregar. O filtro por
  // owner não cabe aqui (a tabela não expõe owner no payload do canal), então
  // o refresh é do servidor, que já aplica RLS.
  useEffect(() => {
    const supabase = criarClienteNavegador()
    let temporizador: ReturnType<typeof setTimeout> | null = null

    const canal = supabase
      .channel(`conversa:${numero}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mensagens' },
        () => {
          if (temporizador) clearTimeout(temporizador)
          temporizador = setTimeout(() => {
            temporizador = null
            router.refresh()
          }, ATRASO_REFRESH_MS)
        },
      )
      .subscribe()

    return () => {
      if (temporizador) clearTimeout(temporizador)
      supabase.removeChannel(canal)
    }
  }, [numero, router])

  async function enviar() {
    const limpo = texto.trim()
    if (!limpo || enviando) return

    setErro('')
    setEnviando(true)
    const resultado = await enviarMensagem(numero, limpo)
    setEnviando(false)

    if (resultado.erro) {
      // O texto fica: perder o que a pessoa escreveu por causa de uma falha
      // de rede é pior que repetir o erro na tela.
      setErro(resultado.erro)
      return
    }

    setTexto('')
    router.refresh()
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-lg font-semibold text-foreground">{nome}</h1>

      {iniciais.length === 0 ? (
        <p className="flex-1 text-sm text-muted-foreground">
          Nenhuma mensagem nesta conversa ainda.
        </p>
      ) : (
        <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {iniciais.map((m) => (
            <li
              key={m.id}
              className={cn(
                'max-w-[75%] rounded-lg px-3 py-2',
                m.direcao === 'saida'
                  ? 'self-end bg-primary/10'
                  : 'self-start bg-muted',
              )}
            >
              <p className="whitespace-pre-wrap text-sm text-foreground">{m.texto}</p>
              <span className="text-[11px] text-muted-foreground">
                {formatarDataHora(m.quando)}
                {m.status === 'falhou' && ' · Não entregue'}
                {m.status === 'lida' && ' · Lida'}
                {m.status === 'entregue' && ' · Entregue'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="flex items-end gap-2">
        <textarea
          aria-label="Mensagem"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Escreva a resposta..."
        />
        <Button onClick={enviar} disabled={enviando} className="gap-1.5">
          <Send className="size-4" />
          Enviar
        </Button>
      </div>
    </div>
  )
}
