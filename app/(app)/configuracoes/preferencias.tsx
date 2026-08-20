'use client'

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

const notificacoes = [
  {
    id: 'novas-msg',
    label: 'Novas mensagens',
    desc: 'Receber alerta a cada nova conversa',
    ligado: true,
  },
  {
    id: 'disparos',
    label: 'Status de disparos',
    desc: 'Notificar ao concluir uma campanha',
    ligado: true,
  },
  {
    id: 'conexao',
    label: 'Queda de conexão',
    desc: 'Avisar quando uma instância cair',
    ligado: false,
  },
]

export function Preferencias() {
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
            Escolha o que deseja acompanhar — a entrega das notificações chega na
            Entrega 2.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {notificacoes.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor={n.id} className="text-sm font-medium text-foreground">
                  {n.label}
                </Label>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <Switch id={n.id} defaultChecked={n.ligado} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
