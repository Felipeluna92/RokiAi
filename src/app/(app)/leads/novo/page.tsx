import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { NewLeadForm } from './new-lead-form'

export const metadata = { title: 'Novo lead · RokiAi' }

export default function NewLeadPage() {
  return (
    <>
      <PageHeader title="Novo lead" subtitle="Indicação ou contato que não veio do Google" />
      <Card className="max-w-xl">
        <NewLeadForm />
      </Card>
    </>
  )
}
