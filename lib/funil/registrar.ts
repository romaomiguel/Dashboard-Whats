import { decidirMovimento } from '@/lib/funil'
import { chaveDoNumero } from '@/lib/numeros'

/** O mínimo do cliente Supabase que esta função usa. */
type ClienteAdmin = {
  from: (tabela: string) => any // eslint-disable-line @typescript-eslint/no-explicit-any
}

type Dados = {
  ownerId: string
  numero: string
  direcao: 'entrada' | 'saida'
}

/**
 * Inscreve a conversa no funil e promove quem respondeu.
 *
 * Nunca estoura: quem chama é o webhook e o envio, e os dois têm trabalho
 * mais importante que este. Falha aqui vira log.
 */
export async function registrarNoFunil(admin: ClienteAdmin, dados: Dados): Promise<void> {
  try {
    const chave = chaveDoNumero(dados.numero)

    const { data: etapas } = await admin
      .from('etapas')
      .select('id, nome, papel')
      .eq('owner_id', dados.ownerId)
      .not('papel', 'is', null)

    const papeis = (etapas ?? []) as { id: string; nome: string; papel: string }[]
    const entrada = papeis.find((e) => e.papel === 'entrada') ?? null
    const respondeu = papeis.find((e) => e.papel === 'respondeu') ?? null

    const { data: linha } = await admin
      .from('funil')
      .select('id, etapa_id, etapas(nome)')
      .eq('owner_id', dados.ownerId)
      .eq('chave_numero', chave)
      .maybeSingle()

    const atual = linha as { id: string; etapa_id: string | null; etapas?: { nome?: string } } | null

    const movimento = decidirMovimento({
      existe: Boolean(atual),
      etapaAtualId: atual?.etapa_id ?? null,
      direcao: dados.direcao,
      etapaEntradaId: entrada?.id ?? null,
      etapaRespondeuId: respondeu?.id ?? null,
    })

    if (movimento.tipo === 'nada') return

    if (movimento.tipo === 'alocar') {
      // Upsert e não insert: duas mensagens da mesma conversa podem chegar
      // ao mesmo tempo, e o índice único resolve sem virar erro.
      const { error } = await admin.from('funil').upsert(
        {
          owner_id: dados.ownerId,
          chave_numero: chave,
          // A forma vista agora: é o número que o card mostra e linka.
          numero: dados.numero,
          etapa_id: movimento.etapaId,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: 'owner_id,chave_numero' },
      )

      if (error) console.error('[funil] não inscreveu:', error.code, error.message)
      return
    }

    // Compare-and-swap, não update cego: o filtro repete a etapa que a
    // leitura acima viu. Entre ler e escrever cabe um arraste — a pessoa
    // leva o card para "Negociando" e esta promoção, filtrando só por id,
    // o puxaria de volta para "Em conversa". A seção 3 do design promete
    // que mensagem recebida nunca desfaz movimento manual; sem esta
    // condição a promessa vale só quando ninguém está usando o quadro.
    //
    // `.select('id')` é o que faz o PostgREST devolver as linhas afetadas
    // (`Prefer: return=representation`), e é por elas que dá para saber se a
    // condição ainda valia — sem isso, `update` só devolve erro, e "zero
    // linhas" é indistinguível de "gravou".
    const { data: promovidas, error: erroUpdate } = await admin
      .from('funil')
      .update({
        etapa_id: movimento.etapaId,
        numero: dados.numero,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', atual!.id)
      .eq('owner_id', dados.ownerId)
      .eq('etapa_id', atual!.etapa_id)
      .select('id')

    if (erroUpdate) {
      console.error('[funil] não promoveu:', erroUpdate.code, erroUpdate.message)
      // Sem este return o histórico gravaria "Novo → Em conversa" para uma
      // promoção que não aconteceu: o card fica em "Novo" e a linha do tempo
      // jura que ele saiu de lá. É exatamente a história falsa que a coluna
      // `automatico` existe para não contar.
      return
    }

    // Nenhuma linha casou: o card já não estava na etapa lida. Nada mudou no
    // funil, então não há movimento a historiar.
    if ((promovidas ?? []).length === 0) return

    const { error: erroHistorico } = await admin.from('funil_historico').insert({
      owner_id: dados.ownerId,
      funil_id: atual!.id,
      de: atual?.etapas?.nome ?? null,
      para: respondeu?.nome ?? '',
      automatico: true,
    })

    if (erroHistorico) {
      console.error('[funil] histórico não gravou:', erroHistorico.code, erroHistorico.message)
    }
  } catch (causa) {
    console.error('[funil] registrar falhou:', causa)
  }
}
