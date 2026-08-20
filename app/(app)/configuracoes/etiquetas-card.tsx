'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { Plus, Tag, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CORES_ETIQUETA,
  ESTILO_ETIQUETA,
  LIMITE_NOME_ETIQUETA,
  ROTULO_COR,
  type Etiqueta,
} from '@/lib/etiquetas'
import {
  criarEtiqueta,
  excluirEtiqueta,
  type EstadoEtiqueta,
} from './actions'

function BotaoAdicionar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="gap-2" disabled={pending}>
      <Plus className="size-4" />
      {pending ? 'Salvando...' : 'Adicionar'}
    </Button>
  )
}

export function EtiquetasCard({ etiquetas }: { etiquetas: Etiqueta[] }) {
  const [estado, enviar] = useActionState<EstadoEtiqueta, FormData>(
    criarEtiqueta,
    {},
  )
  const [cor, setCor] = useState<string>('verde')
  const [excluindo, iniciarExclusao] = useTransition()
  const [erroExclusao, setErroExclusao] = useState('')

  function excluir(id: string) {
    setErroExclusao('')
    iniciarExclusao(async () => {
      const resultado = await excluirEtiqueta(id)
      if (resultado.erro) setErroExclusao(resultado.erro)
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Etiquetas</CardTitle>
        <CardDescription>
          Classifique seus contatos. As etiquetas aqui aparecem no cadastro de
          contatos.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {etiquetas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
            <Tag className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhuma etiqueta cadastrada ainda.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {etiquetas.map((e) => (
              <li
                key={e.id}
                className="group flex items-center gap-3 rounded-lg border border-border px-3 py-2"
              >
                <Badge className={ESTILO_ETIQUETA[e.cor]}>{e.nome}</Badge>
                <span className="flex-1 text-xs text-muted-foreground">
                  {ROTULO_COR[e.cor]}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => excluir(e.id)}
                  disabled={excluindo}
                  aria-label={`Excluir etiqueta ${e.nome}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {erroExclusao && (
          <p role="alert" className="text-sm text-destructive">
            {erroExclusao}
          </p>
        )}

        <form action={enviar} className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="etiqueta-nome">Nova etiqueta</Label>
              <Input
                id="etiqueta-nome"
                name="nome"
                placeholder="Ex: Orçamento enviado"
                maxLength={LIMITE_NOME_ETIQUETA}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="etiqueta-cor">Cor</Label>
              <input type="hidden" name="cor" value={cor} />
              <Select value={cor} onValueChange={(v) => setCor(String(v))}>
                <SelectTrigger id="etiqueta-cor" className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CORES_ETIQUETA.map((c) => (
                    <SelectItem key={c} value={c}>
                      {ROTULO_COR[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <BotaoAdicionar />
          </div>

          {estado.erro && (
            <p role="alert" className="text-sm text-destructive">
              {estado.erro}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
