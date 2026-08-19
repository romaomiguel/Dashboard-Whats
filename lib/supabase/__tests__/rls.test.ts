import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

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
      .insert({ owner_id: ownerA, evolution_name: `inst_teste_${Date.now()}` })
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
})
