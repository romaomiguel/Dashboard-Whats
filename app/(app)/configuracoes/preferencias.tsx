'use client'

import { useState, useTransition } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { Preferencias as PreferenciasSalvas } from '@/lib/consultas/preferencias'
import type { TipoNotificacao } from '@/lib/notificacoes'
import { salvarPreferencia } from './actions'

const NOTIFICACOES: {
  tipo: TipoNotificacao
  chave: keyof PreferenciasSalvas
  label: string
  desc: string
}[] = [
  {
    tipo: 'mensagem',
    chave: 'notificar_mensagem',
    label: 'Novas mensagens',
    desc: 'Receber alerta a cada nova conversa',
  },
  {
    tipo: 'disparo',
    chave: 'notificar_disparo',
    label: 'Status de disparos',
    desc: 'Notificar ao concluir uma campanha',
  },
  {
    tipo: 'conexao',
    chave: 'notificar_conexao',
    label: 'Queda de conexão',
    desc: 'Avisar quando uma instância cair',
  },
]

export function Preferencias({
  preferencias,
}: {
  preferencias: PreferenciasSalvas
}) {
  const [valores, setValores] = useState(preferencias)
  const [salvando, iniciarSalvamento] = useTransition()
  const [erro, setErro] = useState('')

  function alternar(
    tipo: TipoNotificacao,
    chave: keyof PreferenciasSalvas,
    ligado: boolean,
  ) {
    setErro('')
    // Move na hora e desfaz se falhar: preferência é interruptor, não
    // formulário — esperar o servidor para reagir parece travado.
    setValores((atual) => ({ ...atual, [chave]: ligado }))

    iniciarSalvamento(async () => {
      const resultado = await salvarPreferencia(tipo, ligado)
      if (resultado.erro) {
        setValores((atual) => ({ ...atual, [chave]: !ligado }))
        setErro(resultado.erro)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aparência</CardTitle>
          <CardDescription>Alterne entre modo claro e escuro</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-foreground">Tema da interface</span>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notificações</CardTitle>
          <CardDescription>
            Escolha o que aparece no sino. Desligado, a notificação não chega a
            ser criada.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {NOTIFICACOES.map((n) => (
            <div key={n.tipo} className="flex items-center justify-between gap-4">
              <div>
                <Label
                  htmlFor={n.tipo}
                  className="text-sm font-medium text-foreground"
                >
                  {n.label}
                </Label>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <Switch
                id={n.tipo}
                checked={valores[n.chave]}
                disabled={salvando}
                onCheckedChange={(ligado) =>
                  alternar(n.tipo, n.chave, Boolean(ligado))
                }
              />
            </div>
          ))}

          {erro && (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
