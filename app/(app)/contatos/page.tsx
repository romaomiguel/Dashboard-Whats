'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { contatos as contatosExemplo, type Contato } from '@/lib/data'
import { iniciais } from '@/lib/iniciais'

const estiloTag: Record<Contato['tag'], string> = {
  VIP: 'bg-primary/15 text-primary',
  Cliente: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  Lead: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  Inativo: 'bg-muted text-muted-foreground',
}

export default function Page() {
  const { mostrarExemplo } = useDadosExemplo()
  const [lista, setLista] = useState<Contato[]>(contatosExemplo)
  const [busca, setBusca] = useState('')
  const [selecionados, setSelecionados] = useState<string[]>([])

  // Alternar o selo de dados de exemplo recarrega a lista: exclusões locais
  // valem só enquanto o exemplo estiver ligado.
  useEffect(() => {
    setLista(mostrarExemplo ? contatosExemplo : [])
    setSelecionados([])
  }, [mostrarExemplo])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return lista
    return lista.filter(
      (c) => c.nome.toLowerCase().includes(termo) || c.numero.includes(termo),
    )
  }, [lista, busca])

  const todosSelecionados =
    filtrados.length > 0 && filtrados.every((c) => selecionados.includes(c.numero))

  function alternarTodos() {
    setSelecionados(todosSelecionados ? [] : filtrados.map((c) => c.numero))
  }

  function alternarUm(numero: string) {
    setSelecionados((atual) =>
      atual.includes(numero)
        ? atual.filter((n) => n !== numero)
        : [...atual, numero],
    )
  }

  function excluirUm(numero: string) {
    setLista((atual) => atual.filter((c) => c.numero !== numero))
    setSelecionados((atual) => atual.filter((n) => n !== numero))
  }

  function excluirSelecionados() {
    setLista((atual) => atual.filter((c) => !selecionados.includes(c.numero)))
    setSelecionados([])
  }

  return (
    <>
      <SeloDadosExemplo />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm">
          <Contact className="size-4 text-primary" />
          <span className="font-medium text-foreground">{lista.length}</span>
          <span className="text-muted-foreground">contatos no total</span>
        </div>
        <div className="flex gap-2">
          <ImportarContatosDialog />
          <NovoContatoDialog />
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
                onClick={excluirSelecionados}
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
                    key={c.numero}
                    className="group flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selecionados.includes(c.numero)}
                      onCheckedChange={() => alternarUm(c.numero)}
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
                    <Badge className={estiloTag[c.tag]}>{c.tag}</Badge>
                    <span className="hidden w-32 text-right text-xs text-muted-foreground sm:block">
                      {c.ultimaInteracao}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      onClick={() => excluirUm(c.numero)}
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
