'use server'

import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/server'

export type EstadoLogin = { erro?: string }

export async function entrar(
  _estadoAnterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get('email') ?? '').trim()
  const senha = String(formData.get('senha') ?? '')

  if (!email || !senha) {
    return { erro: 'Preencha e-mail e senha.' }
  }

  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  })

  // Mensagem genérica de propósito: distinguir "e-mail não existe" de
  // "senha errada" permite descobrir quem tem conta no sistema.
  if (error) return { erro: 'E-mail ou senha inválidos.' }

  const destino = String(formData.get('destino') ?? '/')
  redirect(destino.startsWith('/') ? destino : '/')
}

export async function sair() {
  const supabase = await criarClienteServidor()
  await supabase.auth.signOut()
  redirect('/login')
}
