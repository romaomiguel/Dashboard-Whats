'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export const CHAVE_DADOS_EXEMPLO = 'zapcrm:dados-exemplo'

type ContextoDadosExemplo = {
  mostrarExemplo: boolean
  alternar: () => void
  /** false durante o primeiro render, antes de ler o localStorage. */
  pronto: boolean
}

const Contexto = createContext<ContextoDadosExemplo | null>(null)

export function DadosExemploProvider({ children }: { children: React.ReactNode }) {
  const [mostrarExemplo, setMostrarExemplo] = useState(true)
  const [pronto, setPronto] = useState(false)

  // localStorage só existe no navegador; ler aqui evita divergência
  // entre o HTML do servidor e a primeira renderização do cliente.
  useEffect(() => {
    setMostrarExemplo(window.localStorage.getItem(CHAVE_DADOS_EXEMPLO) !== 'off')
    setPronto(true)
  }, [])

  const alternar = useCallback(() => {
    setMostrarExemplo((atual) => {
      const proximo = !atual
      window.localStorage.setItem(CHAVE_DADOS_EXEMPLO, proximo ? 'on' : 'off')
      return proximo
    })
  }, [])

  return (
    <Contexto.Provider value={{ mostrarExemplo, alternar, pronto }}>
      {children}
    </Contexto.Provider>
  )
}

export function useDadosExemplo() {
  const contexto = useContext(Contexto)
  if (!contexto) {
    throw new Error('useDadosExemplo precisa estar dentro de DadosExemploProvider')
  }
  return contexto
}
