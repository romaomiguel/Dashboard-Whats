'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  criarEtapa,
  definirPapel,
  moverNoFunil,
  removerEtapa,
} from '@/app/(app)/esteira/actions'
import { resolverArraste } from '@/app/(app)/esteira/arraste'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ETAPAS_PADRAO, LIMITE_NOME_ETAPA } from '@/lib/esteira'
import { PAPEIS, type Papel } from '@/lib/funil'
import { chaveDoNumero } from '@/lib/numeros'
import type { Etapa, LinhaDoFunil } from '@/lib/consultas/esteira'

/**
 * Um card de conversa, arrastável.
 *
 * A alça é um `<button>` de verdade e não o card inteiro: o card carrega
 * texto que a pessoa pode querer selecionar, e um alvo de arraste que cobre
 * tudo rouba a seleção no toque. A alça também é o que dá foco de teclado ao
 * arraste — sem ela o `KeyboardSensor` não teria onde ser acionado.
 */
function Card({ linha }: { linha: LinhaDoFunil }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: linha.id,
    // Vai junto no evento para que a decisão do arraste possa descartar o
    // drop na própria coluna sem consultar o servidor.
    data: { etapaId: linha.etapaId },
  })

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
      }}
      className="flex items-start justify-between gap-2 rounded-md border border-border bg-background p-2.5"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">{linha.nome}</span>
        <span className="truncate text-xs text-muted-foreground">{linha.numero}</span>
      </div>

      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover ${linha.nome}`}
        className="shrink-0 cursor-grab touch-none rounded px-1 text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        {/* O desenho da alça não acrescenta nada a quem ouve a tela: o nome
            acessível já está no botão. */}
        <span aria-hidden="true">⠿</span>
      </button>
    </article>
  )
}

/**
 * Uma coluna do quadro: alvo de soltura e lista rolável.
 *
 * A `<section>` tem altura máxima e a lista rola por dentro; sem isso, uma
 * coluna cheia estica a página inteira e as outras colunas somem da vista.
 */
function Coluna({
  etapa,
  linhas,
  paraRemover,
  aoRemover,
  aoMarcarPapel,
}: {
  etapa: Etapa
  linhas: LinhaDoFunil[]
  paraRemover: string | null
  aoRemover: (etapaId: string) => void
  aoMarcarPapel: (etapaId: string, papel: Papel) => void
}) {
  // O id do alvo de soltura é o id da etapa: é ele que `moverNoFunil` espera.
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id })
  const armada = paraRemover === etapa.id

  return (
    <section
      aria-label={etapa.nome}
      className={`flex max-h-[70vh] w-64 shrink-0 flex-col gap-2 rounded-lg border p-3 ${
        isOver ? 'border-ring bg-muted/70' : 'border-border bg-muted/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {/* O contador fica fora do <h2>: dentro dele, entraria na computação
            do nome acessível do cabeçalho ("Novo 1" em vez de "Novo") e
            sumiria de leitor de tela ao virar aria-hidden. Aqui do lado ele
            continua lido normalmente. */}
        <div className="flex items-baseline gap-1.5">
          <h2 className="text-sm font-semibold text-foreground">{etapa.nome}</h2>
          <span className="text-xs font-normal text-muted-foreground">{linhas.length}</span>
        </div>

        <button
          type="button"
          onClick={() => aoRemover(etapa.id)}
          aria-label={
            armada ? `Confirmar remoção da etapa ${etapa.nome}?` : `Remover etapa ${etapa.nome}`
          }
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          {armada ? 'Confirmar remoção?' : 'Remover'}
        </button>
      </div>

      {/* Papel é o que a automação procura numa etapa; o nome dela pode mudar
          à vontade sem quebrar nada. */}
      <div className="flex items-center gap-2">
        {PAPEIS.map((papel) => (
          <button
            key={papel}
            type="button"
            onClick={() => aoMarcarPapel(etapa.id, papel)}
            aria-label={`Usar ${etapa.nome} como ${papel}`}
            aria-pressed={etapa.papel === papel}
            className={`text-[11px] ${
              etapa.papel === papel
                ? 'font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {papel === 'entrada' ? 'entrada' : 'respondeu'}
          </button>
        ))}
      </div>

      <SortableContext items={linhas.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {linhas.map((l) => (
            <Card key={l.id} linha={l} />
          ))}
        </div>
      </SortableContext>
    </section>
  )
}

export function Quadro({ etapas, linhas }: { etapas: Etapa[]; linhas: LinhaDoFunil[] }) {
  const router = useRouter()
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [nomeNovaEtapa, setNomeNovaEtapa] = useState('')
  const [criandoEtapa, setCriandoEtapa] = useState(false)
  const [criandoFunil, setCriandoFunil] = useState(false)
  // Etapa esperando o segundo clique. Sem `confirm()`/modal (quebra em
  // teste e em automação): a confirmação vira estado do próprio componente.
  const [paraRemover, setParaRemover] = useState<string | null>(null)

  // Os três sensores, não só o de ponteiro: arrastar só com mouse seria uma
  // regressão de acessibilidade — o toque e o teclado precisam do mesmo
  // caminho. A distância mínima no ponteiro evita que um clique na alça vire
  // arraste; o atraso no toque preserva a rolagem da coluna com o dedo.
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function mover(funilId: string, etapaId: string) {
    setErro('')
    // Mover para outra coluna não pode deixar uma remoção armada esperando um
    // clique perdido tempos depois.
    setParaRemover(null)
    const resultado = await moverNoFunil(funilId, etapaId)
    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }
    router.refresh()
  }

  async function aoSoltar(evento: DragEndEvent) {
    // Duas traduções antes de decidir, e é por isso que elas ficam aqui e não
    // dentro de `resolverArraste`: ele é puro para poder ser testado, já que
    // arrastar não é testável de forma honesta em jsdom.
    //
    // 1) `active.data` do dnd-kit é um ref — o dado útil está em `.current`.
    // 2) soltar em cima de outro card devolve o id do card, não o da coluna;
    //    sem traduzir para a etapa dele, o destino seria um id que não existe
    //    em `etapas` e o servidor responderia "Etapa não encontrada".
    const sobre = evento.over ? String(evento.over.id) : null
    const etapaDestino =
      sobre === null
        ? null
        : etapas.some((e) => e.id === sobre)
          ? sobre
          : (linhas.find((l) => l.id === sobre)?.etapaId ?? null)

    const destino = resolverArraste({
      active: {
        id: evento.active.id,
        data: evento.active.data.current as { etapaId?: string | null } | undefined,
      },
      over: etapaDestino ? { id: etapaDestino } : null,
    })
    if (!destino) return

    await mover(destino.funilId, destino.etapaId)
  }

  async function marcarPapel(etapaId: string, papel: Papel) {
    setErro('')
    setParaRemover(null)
    const alvo = etapas.find((e) => e.id === etapaId)
    // Clicar no papel que a etapa já tem tira o papel dela: é o único jeito
    // de desligar a automação sem apagar a coluna.
    const resultado = await definirPapel(etapaId, alvo?.papel === papel ? null : papel)
    if (resultado.erro) {
      setErro(resultado.erro)
      return
    }
    router.refresh()
  }

  async function adicionarEtapa() {
    const limpo = nomeNovaEtapa.trim()
    // Sem guarda, um duplo clique manda `criarEtapa` duas vezes: a segunda
    // bate no nome já criado pela primeira e pinta erro de duplicidade sobre
    // uma criação que na verdade funcionou.
    if (!limpo || criandoEtapa) return

    setErro('')
    setParaRemover(null)
    setCriandoEtapa(true)
    try {
      const resultado = await criarEtapa(limpo)
      if (resultado.erro) {
        setErro(resultado.erro)
        return
      }
      setNomeNovaEtapa('')
      router.refresh()
    } finally {
      setCriandoEtapa(false)
    }
  }

  /**
   * Cria as quatro etapas padrão em ordem, uma de cada vez: são poucas e a
   * ordem final (usada em `proximaOrdem`) depende da ordem de inserção. Para
   * na primeira que falhar, mas atualiza a tela mesmo assim: as etapas
   * anteriores já foram gravadas, e sem o refresh o quadro continua mostrando
   * o estado vazio, escondendo o progresso e levando a pessoa a tentar de
   * novo pela etapa que já existe (erro de nome duplicado).
   */
  async function criarFunilPadrao() {
    setErro('')
    setCriandoFunil(true)
    try {
      for (const [indice, nome] of ETAPAS_PADRAO.entries()) {
        const resultado = await criarEtapa(nome)
        if (resultado.erro) {
          setErro(resultado.erro)
          router.refresh()
          return
        }
        // As duas primeiras etapas do funil padrão carregam a automação;
        // sem isto o funil nasceria bonito e inerte.
        const papel = indice === 0 ? 'entrada' : indice === 1 ? 'respondeu' : null
        if (papel && resultado.id) await definirPapel(resultado.id, papel)
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
          disabled={criandoEtapa}
        />
      </div>
      <Button type="button" size="sm" disabled={criandoEtapa} onClick={adicionarEtapa}>
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

  // Busca por número compara pela chave canônica: o contato pode ter sido
  // salvo com o nono dígito e a conversa ter vindo sem, e digitar qualquer
  // uma das formas tem de achar a mesma pessoa.
  const termo = busca.trim().toLowerCase()
  const termoCanonico = chaveDoNumero(termo)
  const visiveis = linhas.filter(
    (l) =>
      !termo ||
      l.nome.toLowerCase().includes(termo) ||
      (termoCanonico !== '' && chaveDoNumero(l.numero).includes(termoCanonico)),
  )

  return (
    <div className="flex flex-col gap-3">
      {regiaoErro}

      <div className="flex flex-wrap items-end gap-4">
        {formularioNovaEtapa}

        <div className="flex flex-col gap-1">
          <label htmlFor="busca-conversa" className="text-xs font-medium text-muted-foreground">
            Buscar
          </label>
          <Input
            id="busca-conversa"
            type="search"
            aria-label="Buscar conversa"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome ou número"
            className="w-56"
          />
        </div>
      </div>

      <DndContext sensors={sensores} collisionDetection={closestCorners} onDragEnd={aoSoltar}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {/* Só as etapas: não existe mais coluna "Sem etapa". A linha do
              funil cuja etapa não está nesta lista (etapa apagada, ou criada
              em outra aba depois desta leitura) simplesmente não aparece —
              a próxima mensagem daquela conversa a devolve para a entrada.
              Isso é o comportamento pretendido, não um card perdido. */}
          {etapas.map((etapa) => (
            <Coluna
              key={etapa.id}
              etapa={etapa}
              linhas={visiveis.filter((l) => l.etapaId === etapa.id)}
              paraRemover={paraRemover}
              aoRemover={removerColuna}
              aoMarcarPapel={marcarPapel}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
