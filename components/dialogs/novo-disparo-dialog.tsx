'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { Loader2, Plus, Send } from 'lucide-react'
import { criarDisparo, type EstadoDisparo } from '@/app/(app)/disparos/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Conexao } from '@/lib/conexoes'
import {
  LIMITE_MENSAGEM,
  LIMITE_NOME_DISPARO,
  MINUTOS_AGORA,
} from '@/lib/disparos'
import type { Etiqueta } from '@/lib/etiquetas'

function BotaoCriar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="gap-2" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Send className="size-4" />
      )}
      {pending ? 'Criando...' : 'Criar disparo'}
    </Button>
  )
}

export function NovoDisparoDialog({
  etiquetas,
  conexoes,
}: {
  etiquetas: Etiqueta[]
  conexoes: Conexao[]
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [conexao, setConexao] = useState('')
  const [publico, setPublico] = useState('todos')
  const [quando, setQuando] = useState('agora')
  const [estado, enviar] = useActionState<EstadoDisparo, FormData>(
    criarDisparo,
    {},
  )

  useEffect(() => {
    if (estado.ok) {
      setAberto(false)
      setConexao('')
      setPublico('todos')
      setQuando('agora')
      router.refresh()
    }
  }, [estado, router])

  // Só conexão conectada dispara; oferecer as outras levaria a um erro que o
  // usuário só descobriria depois de preencher tudo.
  const disponiveis = conexoes.filter((c) => c.status === 'conectada')

  const itensConexao = Object.fromEntries(disponiveis.map((c) => [c.id, c.nome]))
  const itensPublico = {
    todos: 'Todos os contatos',
    ...Object.fromEntries(etiquetas.map((e) => [e.id, e.nome])),
  }
  const itensQuando = {
    agora: `Agora (em ${MINUTOS_AGORA} minuto)`,
    agendar: 'Agendar data e hora',
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="size-4" />
        Novo disparo
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo disparo</DialogTitle>
          <DialogDescription>
            Configure uma nova campanha de mensagens em massa.
          </DialogDescription>
        </DialogHeader>

        {disponiveis.length === 0 ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma conexão conectada. Conecte um WhatsApp em Conexão antes de
              disparar.
            </p>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Fechar
              </DialogClose>
            </DialogFooter>
          </div>
        ) : (
          <form action={enviar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="disparo-nome">Nome da campanha</Label>
              <Input
                id="disparo-nome"
                name="nome"
                placeholder="Ex: Promoção de Natal"
                maxLength={LIMITE_NOME_DISPARO}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="disparo-conexao">Conexão</Label>
                <input type="hidden" name="conexao" value={conexao} />
                <Select
                  items={itensConexao}
                  value={conexao}
                  onValueChange={(v) => setConexao(String(v ?? ''))}
                >
                  <SelectTrigger id="disparo-conexao">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {disponiveis.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="disparo-publico">Público</Label>
                <input type="hidden" name="publico" value={publico} />
                <Select
                  items={itensPublico}
                  value={publico}
                  onValueChange={(v) => setPublico(String(v ?? 'todos'))}
                >
                  <SelectTrigger id="disparo-publico">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os contatos</SelectItem>
                    {etiquetas.map((etiqueta) => (
                      <SelectItem key={etiqueta.id} value={etiqueta.id}>
                        {etiqueta.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="disparo-msg">Mensagem</Label>
              <Textarea
                id="disparo-msg"
                name="mensagem"
                rows={4}
                maxLength={LIMITE_MENSAGEM}
                placeholder="Escreva a mensagem que será enviada..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="disparo-quando">Envio</Label>
                <input type="hidden" name="quando" value={quando} />
                <Select
                  items={itensQuando}
                  value={quando}
                  onValueChange={(v) => setQuando(String(v ?? 'agora'))}
                >
                  <SelectTrigger id="disparo-quando">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agora">
                      Agora (em {MINUTOS_AGORA} minuto)
                    </SelectItem>
                    <SelectItem value="agendar">Agendar data e hora</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {quando === 'agendar' && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="disparo-data">Data e hora</Label>
                  <Input
                    id="disparo-data"
                    name="agendado_para"
                    type="datetime-local"
                    required
                  />
                </div>
              )}
            </div>

            {quando === 'agora' && (
              <p className="text-xs text-muted-foreground">
                O envio começa em {MINUTOS_AGORA} minuto, para dar tempo de
                cancelar caso algo esteja errado.
              </p>
            )}

            {estado.erro && (
              <p role="alert" className="text-sm text-destructive">
                {estado.erro}
              </p>
            )}

            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancelar
              </DialogClose>
              <BotaoCriar />
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
