import { ConnectionsPanel } from '@/components/dashboard/connections-panel'
import { DeliveryScaleChart } from '@/components/dashboard/delivery-scale-chart'
import { MessagesBarChart } from '@/components/dashboard/messages-bar-chart'
import { RecentMessages } from '@/components/dashboard/recent-messages'
import { StatCards } from '@/components/dashboard/stat-cards'
import { SeloDadosExemplo } from '@/components/selo-dados-exemplo'
import { listarConexoes } from '@/lib/consultas/conexao'
import { listarConversas } from '@/lib/consultas/mensagens'
import { carregarResumo } from '@/lib/consultas/resumo'

export default async function Page() {
  const [resumo, conversas, conexoes] = await Promise.all([
    carregarResumo(),
    listarConversas(),
    listarConexoes(),
  ])

  return (
    <>
      <SeloDadosExemplo />
      <StatCards resumo={resumo} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MessagesBarChart semana={resumo.semana} />
        </div>
        <div>
          <DeliveryScaleChart funil={resumo.funil} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentMessages conversas={conversas} />
        </div>
        <div>
          <ConnectionsPanel conexoes={conexoes} />
        </div>
      </div>
    </>
  )
}
