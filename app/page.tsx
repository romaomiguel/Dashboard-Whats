import { ConnectionsPanel } from '@/components/dashboard/connections-panel'
import { DeliveryScaleChart } from '@/components/dashboard/delivery-scale-chart'
import { MessagesBarChart } from '@/components/dashboard/messages-bar-chart'
import { RecentMessages } from '@/components/dashboard/recent-messages'
import { StatCards } from '@/components/dashboard/stat-cards'
import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function Page() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-6">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Visão geral</TabsTrigger>
                <TabsTrigger value="disparos">Disparos</TabsTrigger>
                <TabsTrigger value="contatos">Contatos</TabsTrigger>
              </TabsList>
            </Tabs>

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
          </div>
        </main>
      </div>
    </div>
  )
}
