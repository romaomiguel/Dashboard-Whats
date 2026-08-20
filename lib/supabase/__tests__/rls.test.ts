import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const configurado = Boolean(url && anon && service)

async function entrar(email: string) {
  const cliente = createClient(url!, anon!)
  const { error } = await cliente.auth.signInWithPassword({
    email,
    password: 'senha-de-teste-123',
  })
  if (error) throw new Error(`login falhou para ${email}: ${error.message}`)
  return cliente
}

/**
 * Nome no mesmo formato que o app exige (inst_ + 8 hex).
 *
 * Antes era `inst_teste_${Date.now()}`, que o validarNomeInstancia rejeita.
 * Como este teste grava na tabela de verdade, aquela linha aparecia na tela
 * de Conexão do usuário e travava a tela — o app não conseguia nem gerar QR
 * nem entender o que era aquilo.
 */
function nomeDeTeste() {
  const hex = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0')
  return `inst_${hex}`
}

describe.skipIf(!configurado)('RLS de instances', () => {
  let idDoA: string

  beforeAll(async () => {
    const admin = createClient(url!, service!, {
      auth: { persistSession: false },
    })
    const clienteA = await entrar('teste-a@exemplo.com')
    const { data: usuarioA } = await clienteA.auth.getUser()
    const ownerA = usuarioA.user!.id

    await admin.from('instances').delete().eq('owner_id', ownerA)
    const { data, error } = await admin
      .from('instances')
      // nome virou obrigatório e único por usuário na migration 0005; o
      // sufixo aleatório evita colisão entre rodadas que não limparam.
      .insert({
        owner_id: ownerA,
        nome: `Teste ${Date.now()}`,
        evolution_name: nomeDeTeste(),
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    idDoA = data.id
  })

  it('o dono lê a própria instância', async () => {
    const clienteA = await entrar('teste-a@exemplo.com')
    const { data } = await clienteA.from('instances').select('id').eq('id', idDoA)
    expect(data).toHaveLength(1)
  })

  it('outro usuário não enxerga a instância alheia', async () => {
    const clienteB = await entrar('teste-b@exemplo.com')
    const { data } = await clienteB.from('instances').select('id').eq('id', idDoA)
    expect(data).toEqual([])
  })

  it('outro usuário não consegue alterar a instância alheia', async () => {
    const clienteB = await entrar('teste-b@exemplo.com')
    const { data } = await clienteB
      .from('instances')
      .update({ numero: '+55 11 90000-0000' })
      .eq('id', idDoA)
      .select()
    expect(data).toEqual([])
  })

  it('a service role enxerga tudo', async () => {
    const admin = createClient(url!, service!, {
      auth: { persistSession: false },
    })
    const { data } = await admin.from('instances').select('id').eq('id', idDoA)
    expect(data).toHaveLength(1)
  })

  // Este teste grava no banco de verdade. Sem limpar, a linha ficava para trás
  // e aparecia como conexão na tela do usuário depois de cada rodada.
  afterAll(async () => {
    if (!idDoA) return
    const admin = createClient(url!, service!, {
      auth: { persistSession: false },
    })
    await admin.from('instances').delete().eq('id', idDoA)
  })
})
