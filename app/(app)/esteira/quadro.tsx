'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarEtapa, moverContato, removerEtapa } from '@/app/(app)/esteira/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ETAPAS_PADRAO, LIMITE_NOME_ETAPA } from '@/lib/esteira'
import type { ContatoNaEsteira, Etapa } from '@/lib/consultas/esteira'

/** Coluna dos que ainda não foram triados. */
const SEM_ETAPA = 'Sem etapa'

export function Quadro({
  etapas,
  contatos,
}: {
  etapas: Etapa[]
  contatos: ContatoNaEsteira[]
}) {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [nomeNovaEtapa, setNomeNovaEtapa] = useState('')
  const [criandoFunil, setCriandoFunil] = useState(false)
  // Etapa esperando o segundo clique. Sem `confirm()`/modal (quebra em
  // teste e em automação): a confirmação vira estado do próprio componente.
  const [paraRemover, setParaRemover] = useState<string | null>(null)

  async function mover(contatoId: string, valor: string) {
    setErro('')
    const resultado = await moverContato(contatoId, valor === '' ? null : valor)
    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }
    router.refresh()
  }

  async function adicionarEtapa() {
    const limpo = nomeNovaEtapa.trim()
    if (!limpo) return // nome vazio ou só espaço não vai para o servidor

    setErro('')
    const resultado = await criarEtapa(limpo)
    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }
    setNomeNovaEtapa('')
    router.refresh()
  }

  /**
   * Cria as quatro etapas padrão em ordem, uma de cada vez: são poucas e a
   * ordem final (usada em `proximaOrdem`) depende da ordem de inserção. Para
   * na primeira que falhar, para não deixar o funil pela metade sem avisar.
   */
  async function criarFunilPadrao() {
    setErro('')
    setCriandoFunil(true)
    try {
      for (const nome of ETAPAS_PADRAO) {
        const resultado = await criarEtapa(nome)
        if (resultado.erro) {
          setErro(resultado.erro)
          return
        }
      }
      router.refresh()
    } finally {
      setCriandoFunil(false)
    }
  }

  async function removerColuna(etapaId: string) {
    if (paraRemover !== etapaId) {
      setParaRemover(etapaId)
      return
    }

    setParaRemover(null)
    setErro('')
    const resultado = await removerEtapa(etapaId)
    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }
    router.refresh()
  }

  const formularioNovaEtapa = (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="nova-etapa" className="text-xs font-medium text-muted-foreground">
          Nova etapa
        </label>
        <Input
          id="nova-etapa"
          aria-label="Nome da nova etapa"
          value={nomeNovaEtapa}
          onChange={(e) => setNomeNovaEtapa(e.target.value)}
          maxLength={LIMITE_NOME_ETAPA}
          placeholder="Ex.: Proposta enviada"
          className="w-56"
        />
      </div>
      <Button type="button" size="sm" onClick={adicionarEtapa}>
        Adicionar etapa
      </Button>
    </div>
  )

  const regiaoErro = erro && (
    <p role="alert" className="text-sm text-destructive">
      {erro}
    </p>
  )

  if (etapas.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {regiaoErro}
        {formularioNovaEtapa}

        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            Crie a primeira etapa para começar a organizar os contatos.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={criandoFunil}
            onClick={criarFunilPadrao}
          >
            Criar funil padrão
          </Button>
        </div>
      </div>
    )
  }

  const colunas = [
    ...etapas.map((e) => ({ id: e.id, nome: e.nome })),
    { id: null, nome: SEM_ETAPA },
  ]

  return (
    <div className="flex flex-col gap-3">
      {regiaoErro}
      {formularioNovaEtapa}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {colunas.map((coluna) => {
          const daColuna = contatos.filter((c) => c.etapaId === coluna.id)
          return (
            <section
              key={coluna.id ?? 'sem-etapa'}
              aria-label={coluna.nome}
              className="flex w-64 shrink-0 flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {coluna.nome}
                  {/* aria-hidden: a contagem é decoração visual, não parte do
                      nome acessível do cabeçalho (que precisa ser só o nome
                      da etapa, para bater com o aria-label da seção). */}
                  <span
                    aria-hidden="true"
                    className="ml-1.5 text-xs font-normal text-muted-foreground"
                  >
                    {daColuna.length}
                  </span>
                </h2>

                {/* "Sem etapa" não é uma etapa de verdade: nada para remover. */}
                {coluna.id && (
                  <button
                    type="button"
                    onClick={() => removerColuna(coluna.id as string)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    {paraRemover === coluna.id ? 'Confirmar remoção?' : 'Remover'}
                  </button>
                )}
              </div>

              {daColuna.map((c) => (
                <article
                  key={c.id}
                  className="flex flex-col gap-1.5 rounded-md border border-border bg-background p-2.5"
                >
                  <span className="text-sm font-medium text-foreground">{c.nome}</span>
                  <span className="text-xs text-muted-foreground">{c.numero}</span>

                  {/* Select e não arrastar-e-soltar: funciona no toque, é
                      acessível por teclado e não precisa de biblioteca. */}
                  <select
                    aria-label={`Etapa de ${c.nome}`}
                    value={c.etapaId ?? ''}
                    onChange={(e) => mover(c.id, e.target.value)}
                    className="rounded border border-border bg-background px-1.5 py-1 text-xs"
                  >
                    <option value="">{SEM_ETAPA}</option>
                    {etapas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
            </section>
          )
        })}
      </div>
    </div>
  )
}
