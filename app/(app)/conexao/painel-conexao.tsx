'use client'

import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Signal,
  Smartphone,
  Trash2,
  Webhook,
  Wrench,
} from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { EstadoVazio } from '@/components/estado-vazio'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ESTILO_STATUS,
  LIMITE_NOME_CONEXAO,
  ROTULO_STATUS,
  type Conexao,
} from '@/lib/conexoes'
import {
  corrigirWebhook,
  criarConexao,
  limparOrfas,
  removerConexao,
  verificarConexao,
  type EstadoConexaoUi,
} from './actions'
import { DialogoQr } from './dialogo-qr'

function BotaoCriar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="gap-2" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {pending ? 'Criando...' : 'Criar e ler QR'}
    </Button>
  )
}

function NovaConexaoDialog({
  aoCriar,
}: {
  aoCriar: (id: string, nome: string, qr?: string) => void
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [estado, enviar] = useActionState<EstadoConexaoUi, FormData>(
    criarConexao,
    {},
  )

  useEffect(() => {
    if (estado.ok && estado.id) {
      setAberto(false)
      aoCriar(estado.id, nome, estado.qr)
      setNome('')
      router.refresh()
    }
    // aoCriar e nome mudam a cada render do pai; depender só do estado evita
    // reabrir o QR a cada digitação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado])

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="size-4" />
        Nova conexão
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conexão</DialogTitle>
          <DialogDescription>
            Dê um nome ao aparelho. Em seguida você lê o QR code no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <form action={enviar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="conexao-nome">Nome da conexão</Label>
            <Input
              id="conexao-nome"
              name="nome"
              placeholder="Ex: Comercial 01"
              maxLength={LIMITE_NOME_CONEXAO}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Se a Evolution estiver hibernando no plano free do Render, acordar
            leva até 90 segundos.
          </p>

          {estado.erro && (
            <p role="alert" className="text-sm text-destructive">
              {estado.erro}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <BotaoCriar />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** De quanto em quanto tempo a tela reconfere o estado dos aparelhos. */
const INTERVALO_ESTADO_MS = 30_000

export function PainelConexao({ conexoes }: { conexoes: Conexao[] }) {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [removendo, iniciarRemocao] = useTransition()
  const [conferindo, setConferindo] = useState(false)
  const [limpando, setLimpando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [qrAberto, setQrAberto] = useState<{
    id: string
    nome: string
    qr?: string
  } | null>(null)

  const conectadas = conexoes.filter((c) => c.status === 'conectada').length

  // Desconectar o celular não avisa ninguém: sem reconferir, o cartão ficaria
  // "Conectado" para sempre. O webhook cobre isso em produção, mas só quando a
  // Evolution alcança o app — em desenvolvimento, nunca.
  const conferirEstados = useCallback(
    async (mostrarGiro = false) => {
      if (conexoes.length === 0) return
      if (mostrarGiro) setConferindo(true)

      const antes = conexoes.map((c) => c.status).join()
      const depois = await Promise.all(
        conexoes.map((c) => verificarConexao(c.id)),
      )

      if (mostrarGiro) setConferindo(false)
      if (depois.map((r) => r.status ?? '').join() !== antes) router.refresh()
    },
    [conexoes, router],
  )

  useEffect(() => {
    if (conexoes.length === 0) return
    const relogio = setInterval(() => void conferirEstados(), INTERVALO_ESTADO_MS)
    return () => clearInterval(relogio)
  }, [conexoes.length, conferirEstados])

  function remover(id: string) {
    setErro('')
    iniciarRemocao(async () => {
      const resultado = await removerConexao(id)
      if (resultado.erro) setErro(resultado.erro)
      if (resultado.ok) router.refresh()
    })
  }

  // Instância que ficou na Evolution sem registro aqui continua tentando
  // reconectar com o mesmo número, e sessão duplicada faz o WhatsApp deslogar
  // o aparelho inteiro.
  // Instância criada antes de a NEXT_PUBLIC_APP_URL existir ficou com um
  // endereço relativo gravado na Evolution, que ela nunca consegue chamar.
  // Reapontar evita ter que apagar a conexão e ler o QR de novo.
  function corrigir(id: string) {
    setErro('')
    setAviso('')
    iniciarRemocao(async () => {
      const resultado = await corrigirWebhook(id)
      if (resultado.erro) setErro(resultado.erro)
      else setAviso('Webhook reapontado. Mande uma mensagem para testar.')
    })
  }

  async function limpar() {
    setErro('')
    setAviso('')
    setLimpando(true)
    try {
      const resultado = await limparOrfas()
      if (resultado.erro) setErro(resultado.erro)
      else {
        setAviso(
          resultado.removidas
            ? `${resultado.removidas} instância(s) órfã(s) removida(s) da Evolution.`
            : 'Nenhuma instância órfã encontrada.',
        )
        router.refresh()
      }
    } finally {
      setLimpando(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Signal className="size-4 text-primary" />
          {conectadas} de {conexoes.length}{' '}
          {conexoes.length === 1 ? 'conexão conectada' : 'conexões conectadas'}
        </div>

        <div className="flex gap-2">
          {conexoes.length > 0 && (
            <Button
              variant="outline"
              className="gap-2"
              disabled={conferindo}
              onClick={() => void conferirEstados(true)}
            >
              {conferindo ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Atualizar
            </Button>
          )}

          <Button
            variant="outline"
            className="gap-2"
            disabled={limpando}
            onClick={limpar}
            title="Remove da Evolution instâncias sem registro aqui"
          >
            {limpando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wrench className="size-4" />
            )}
            Limpar órfãs
          </Button>

          <NovaConexaoDialog
            aoCriar={(id, nome, qr) => setQrAberto({ id, nome, qr })}
          />
        </div>
      </div>

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      {aviso && (
        <p role="status" className="text-sm text-primary">
          {aviso}
        </p>
      )}

      {conexoes.length === 0 ? (
        <Card>
          <EstadoVazio
            icone={Smartphone}
            titulo="Nenhuma conexão"
            descricao="Crie uma conexão e leia o QR code no WhatsApp para começar."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {conexoes.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{c.nome}</CardTitle>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {c.nomeEvolution}
                  </p>
                </div>
                <Badge className={ESTILO_STATUS[c.status]}>
                  {ROTULO_STATUS[c.status]}
                </Badge>
              </CardHeader>

              <CardContent className="flex flex-col gap-4">
                <p className="font-mono text-sm text-muted-foreground">
                  {c.numero ?? 'Número aparece após conectar'}
                </p>

                <div className="flex gap-2">
                  {c.status !== 'conectada' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => setQrAberto({ id: c.id, nome: c.nome })}
                    >
                      <QrCode className="size-4" />
                      QR Code
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground"
                    disabled={removendo}
                    onClick={() => corrigir(c.id)}
                    aria-label={`Corrigir webhook de ${c.nome}`}
                    title="Reaponta o webhook desta conexão para a URL atual do app"
                  >
                    <Webhook className="size-4" />
                    Webhook
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground hover:text-destructive"
                    disabled={removendo}
                    onClick={() => remover(c.id)}
                    aria-label={`Remover ${c.nome}`}
                  >
                    <Trash2 className="size-4" />
                    Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {qrAberto && (
        <DialogoQr
          id={qrAberto.id}
          nome={qrAberto.nome}
          qrInicial={qrAberto.qr}
          aberto
          aoFechar={() => {
            setQrAberto(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
