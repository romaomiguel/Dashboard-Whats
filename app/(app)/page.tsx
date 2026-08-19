import { ConnectionsPanel } from '@/components/dashboard/connections-panel'
import { DeliveryScaleChart } from '@/components/dashboard/delivery-scale-chart'
import { MessagesBarChart } from '@/components/dashboard/messages-bar-chart'
import { RecentMessages } from '@/components/dashboard/recent-messages'
import { StatCards } from '@/components/dashboard/stat-cards'
import { SeloDadosExemplo } from '@/components/selo-dados-exemplo'

export default function Page() {
  return (
    <>
      <SeloDadosExemplo />
      <StatCards />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MessagesBarChart />
        </div>
        <div>
          <DeliveryScaleChart />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentMessages />
        </div>
        <div>
          <ConnectionsPanel />
        </div>
      </div>
    </>
  )
}
