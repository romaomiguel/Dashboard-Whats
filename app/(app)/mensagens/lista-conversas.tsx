'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Check, CornerUpLeft, MessageCircle, Search } from 'lucide-react'
import { useDadosExemplo } from '@/components/dados-exemplo-provider'
import { EstadoVazio } from '@/components/estado-vazio'
import { SeloDadosExemplo } from '@/components/selo-dados-exemplo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Conversa } from '@/lib/consultas/mensagens'
import {
  DESCRICAO_CONVERSA,
  ESTADOS_CONVERSA,
  ESTILO_CONVERSA,
  ROTULO_CONVERSA,
  type EstadoConversa,
} from '@/lib/conversas'
import { mensagensRecentes, summary } from '@/lib/data'
import { formatarHora } from '@/lib/datas'
import { iniciais } from '@/lib/iniciais'
import { chaveDoNumero } from '@/lib/numeros'
import { cn } from '@/lib/utils'

/** Linha da lista, venha ela do banco ou dos dados de exemplo. */
type Linha = {
  chave: string
  contato: string
  previa: string
  hora: string
  naoLidas: number
  estado: EstadoConversa
}

/** Os dados de exemplo têm outro vocabulário; traduz para o mesmo modelo. */
const ESTADO_EXEMPLO: Record<string, EstadoConversa> = {
  respondida: 'respondida',
  lida: 'enviada',
  entregue: 'enviada',
}

export function ListaConversas({
  conversas,
  buscaInicial = '',
}: {
  conversas: Conversa[]
  buscaInicial?: string
}) {
  const { mostrarExemplo } = useDadosExemplo()
  const [busca, setBusca] = useState(buscaInicial)
  const [filtro, setFiltro] = useState<EstadoConversa | 'todas'>('todas')

  // Só cai no exemplo quem ainda não trocou mensagem nenhuma.
  const usandoExemplo = conversas.length === 0 && mostrarExemplo

  const lista: Linha[] = usandoExemplo
    ? mensagensRecentes.map((m) => ({
        chave: m.numero,
        contato: m.contato,
        previa: m.previa,
        hora: m.hora,
        naoLidas: m.naoLidas,
        estado: ESTADO_EXEMPLO[m.status] ?? 'enviada',
      }))
    : conversas.map((c) => ({
        chave: c.numero,
        contato: c.nome,
        previa: c.previa,
        hora: formatarHora(c.quando),
        naoLidas: c.naoLidas,
        estado: c.estado,
      }))

  const ativas = usandoExemplo ? summary.mensagens : lista.length

  // Contagem por estado sai da lista inteira, não da filtrada: um contador que
  // muda ao clicar no próprio filtro não serviria para nada.
  const contagem = useMemo(() => {
    const mapa = new Map<EstadoConversa, number>()
    for (const l of lista) mapa.set(l.estado, (mapa.get(l.estado) ?? 0) + 1)
    return mapa
  }, [lista])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    // O destino da notificação leva a forma canônica (sem o nono dígito),
    // mas `m.chave` é o número cru da última mensagem — que, se ela veio de
    // um disparo, é o número do cadastro, com o nono dígito. Comparando os
    // dois pela forma canônica, o clique na notificação encontra a conversa
    // em vez de cair em "Nada encontrado".
    const termoCanonico = chaveDoNumero(termo)
    return lista
      .filter((m) => filtro === 'todas' || m.estado === filtro)
      .filter(
        (m) =>
          !termo ||
          m.contato.toLowerCase().includes(termo) ||
          m.previa.toLowerCase().includes(termo) ||
          (termoCanonico !== '' &&
            chaveDoNumero(m.chave).includes(termoCanonico)),
      )
  }, [lista, busca, filtro])

  const disponiveis = ESTADOS_CONVERSA.filter((e) => (contagem.get(e) ?? 0) > 0)

  return (
    <>
      <SeloDadosExemplo />

      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm">
        <MessageCircle className="size-4 text-primary" />
        <span className="font-medium text-foreground">{ativas}</span>
        <span className="text-muted-foreground">
          {usandoExemplo ? 'conversas de exemplo' : 'conversas'}
        </span>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Conversas</CardTitle>
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              className="pl-9"
              aria-label="Buscar conversa"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </CardHeader>

        {disponiveis.length > 0 && (
          <div
            role="group"
            aria-label="Filtrar por estado"
            className="flex flex-wrap gap-2 border-b border-border px-6 pb-4"
          >
            <Button
              variant={filtro === 'todas' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFiltro('todas')}
              aria-pressed={filtro === 'todas'}
            >
              Todas ({lista.length})
            </Button>

            {disponiveis.map((estado) => (
              <Button
                key={estado}
                variant={filtro === estado ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFiltro(estado)}
                aria-pressed={filtro === estado}
                title={DESCRICAO_CONVERSA[estado]}
              >
                {ROTULO_CONVERSA[estado]} ({contagem.get(estado)})
              </Button>
            ))}
          </div>
        )}

        <CardContent className="p-0">
          {filtradas.length === 0 ? (
            <EstadoVazio
              icone={MessageCircle}
              titulo={
                busca || filtro !== 'todas' ? 'Nada encontrado' : 'Nenhuma conversa'
              }
              descricao={
                busca || filtro !== 'todas'
                  ? 'Nenhuma conversa corresponde ao que você procura.'
                  : 'Conecte seu WhatsApp e faça um disparo — o que sair e o que chegar aparece aqui.'
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {filtradas.map((m) => {
                const conteudo = (
                  <>
                    <div className="relative">
                      <Avatar className="size-10">
                        <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary">
                          {iniciais(m.contato)}
                        </AvatarFallback>
                      </Avatar>
                      {m.estado === 'respondeu' && m.naoLidas > 0 && (
                        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                          {m.naoLidas}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {m.contato}
                        </p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {m.hora}
                        </span>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {m.previa}
                      </p>
                    </div>

                    <Badge
                      className={cn('gap-1', ESTILO_CONVERSA[m.estado])}
                      title={DESCRICAO_CONVERSA[m.estado]}
                    >
                      {m.estado === 'falhou' ? (
                        <AlertCircle className="size-3" />
                      ) : m.estado === 'respondeu' ? (
                        <CornerUpLeft className="size-3" />
                      ) : (
                        <Check className="size-3" />
                      )}
                      {ROTULO_CONVERSA[m.estado]}
                    </Badge>
                  </>
                )

                const classeLinha =
                  'flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-muted/50'

                // Os dados de exemplo usam número fictício: virar link abriria
                // uma thread vazia, parecendo quebrada. Só a conversa real leva
                // à tela da conversa.
                if (usandoExemplo) {
                  return (
                    <div key={m.chave} className={classeLinha}>
                      {conteudo}
                    </div>
                  )
                }

                return (
                  <Link key={m.chave} href={`/mensagens/${m.chave}`} className={classeLinha}>
                    {conteudo}
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
