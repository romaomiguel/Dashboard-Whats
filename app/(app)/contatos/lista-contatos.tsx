'use client'

import { useMemo, useState, useTransition } from 'react'
import { Contact, Search, Trash2 } from 'lucide-react'
import { useDadosExemplo } from '@/components/dados-exemplo-provider'
import { ImportarContatosDialog } from '@/components/dialogs/importar-contatos-dialog'
import { NovoContatoDialog } from '@/components/dialogs/novo-contato-dialog'
import { EstadoVazio } from '@/components/estado-vazio'
import { SeloDadosExemplo } from '@/components/selo-dados-exemplo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import type { ContatoSalvo } from '@/lib/consultas/contatos'
import { contatos as contatosExemplo } from '@/lib/data'
import { COR_EXEMPLO, ESTILO_ETIQUETA, type Etiqueta } from '@/lib/etiquetas'
import { iniciais } from '@/lib/iniciais'
import { excluirContatos } from './actions'

/** Linha da lista, venha ela do banco ou dos dados de exemplo. */
type Linha = {
  id: string
  nome: string
  numero: string
  etiqueta: string | null
  detalhe: string
  ehExemplo: boolean
}

function deExemplo(): Linha[] {
  return contatosExemplo.map((c) => ({
    id: c.numero,
    nome: c.nome,
    numero: c.numero,
    etiqueta: c.tag,
    detalhe: c.ultimaInteracao,
    ehExemplo: true,
  }))
}

function doBanco(salvos: ContatoSalvo[]): Linha[] {
  return salvos.map((c) => ({
    id: c.id,
    nome: c.nome,
    numero: c.numero,
    etiqueta: c.etiqueta,
    detalhe: new Date(c.criadoEm).toLocaleDateString('pt-BR'),
    ehExemplo: false,
  }))
}

export function ListaContatos({
  contatos,
  etiquetas,
  buscaInicial = '',
}: {
  contatos: ContatoSalvo[]
  etiquetas: Etiqueta[]
  buscaInicial?: string
}) {
  const { mostrarExemplo } = useDadosExemplo()
  const [busca, setBusca] = useState(buscaInicial)
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [ocultosDoExemplo, setOcultosDoExemplo] = useState<string[]>([])
  const [excluindo, iniciarExclusao] = useTransition()
  const [erro, setErro] = useState('')

  // Só cai no exemplo quem ainda não tem contato de verdade: assim que o
  // primeiro é cadastrado, a tela mostra a base real e nada mais.
  const usandoExemplo = contatos.length === 0 && mostrarExemplo

  const lista = useMemo(() => {
    if (usandoExemplo) {
      return deExemplo().filter((l) => !ocultosDoExemplo.includes(l.id))
    }
    return doBanco(contatos)
  }, [usandoExemplo, contatos, ocultosDoExemplo])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return lista
    return lista.filter(
      (c) => c.nome.toLowerCase().includes(termo) || c.numero.includes(termo),
    )
  }, [lista, busca])

  const estiloDaEtiqueta = (nome: string | null) => {
    if (!nome) return ESTILO_ETIQUETA.cinza
    const cadastrada = etiquetas.find((e) => e.nome === nome)
    if (cadastrada) return ESTILO_ETIQUETA[cadastrada.cor]
    return ESTILO_ETIQUETA[COR_EXEMPLO[nome] ?? 'cinza']
  }

  const todosSelecionados =
    filtrados.length > 0 && filtrados.every((c) => selecionados.includes(c.id))

  function alternarTodos() {
    setSelecionados(todosSelecionados ? [] : filtrados.map((c) => c.id))
  }

  function alternarUm(id: string) {
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((i) => i !== id) : [...atual, id],
    )
  }

  function excluir(ids: string[]) {
    setErro('')

    // Exemplo não está no banco: some só da tela.
    if (usandoExemplo) {
      setOcultosDoExemplo((atual) => [...atual, ...ids])
      setSelecionados((atual) => atual.filter((i) => !ids.includes(i)))
      return
    }

    iniciarExclusao(async () => {
      const resultado = await excluirContatos(ids)
      if (resultado.erro) setErro(resultado.erro)
      else setSelecionados((atual) => atual.filter((i) => !ids.includes(i)))
    })
  }

  return (
    <>
      <SeloDadosExemplo />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm">
          <Contact className="size-4 text-primary" />
          <span className="font-medium text-foreground">{lista.length}</span>
          <span className="text-muted-foreground">
            {usandoExemplo ? 'contatos de exemplo' : 'contatos no total'}
          </span>
        </div>
        <div className="flex gap-2">
          <ImportarContatosDialog />
          <NovoContatoDialog etiquetas={etiquetas} />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Lista de contatos</CardTitle>
            {selecionados.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                disabled={excluindo}
                onClick={() => excluir(selecionados)}
              >
                <Trash2 className="size-4" />
                Excluir ({selecionados.length})
              </Button>
            )}
          </div>
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar contato..."
              className="pl-9"
              aria-label="Buscar contato"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {erro && (
            <p role="alert" className="px-6 pb-3 text-sm text-destructive">
              {erro}
            </p>
          )}

          {lista.length === 0 ? (
            <EstadoVazio
              icone={Contact}
              titulo="Nenhum contato"
              descricao="Importe uma planilha ou cadastre o primeiro contato da sua base."
            />
          ) : (
            <>
              <div className="flex items-center gap-4 border-y border-border bg-muted/30 px-6 py-2.5">
                <Checkbox
                  checked={todosSelecionados}
                  onCheckedChange={alternarTodos}
                  aria-label="Selecionar todos"
                />
                <span className="text-xs font-medium text-muted-foreground">
                  Selecionar todos
                </span>
              </div>

              <div className="divide-y divide-border">
                {filtrados.map((c) => (
                  <div
                    key={c.id}
                    className="group flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selecionados.includes(c.id)}
                      onCheckedChange={() => alternarUm(c.id)}
                      aria-label={`Selecionar ${c.nome}`}
                    />
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-primary/15 text-xs font-medium text-primary">
                        {iniciais(c.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.nome}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {c.numero}
                      </p>
                    </div>
                    {c.etiqueta ? (
                      <Badge className={estiloDaEtiqueta(c.etiqueta)}>
                        {c.etiqueta}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        sem etiqueta
                      </span>
                    )}
                    <span className="hidden w-32 text-right text-xs text-muted-foreground sm:block">
                      {c.detalhe}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                      disabled={excluindo}
                      onClick={() => excluir([c.id])}
                      aria-label={`Excluir ${c.nome}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}

                {filtrados.length === 0 && (
                  <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                    Nenhum contato encontrado.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
