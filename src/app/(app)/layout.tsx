import { BottomNav, SideNav } from '@/components/nav'
import { requireUser } from '@/lib/auth'
import { ensureDefaults } from '@/lib/defaults'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const { supabase } = await requireUser()
  await ensureDefaults(supabase)
  return (
    <div className="flex min-h-dvh">
      <SideNav />
      <main className="min-w-0 flex-1 px-4 pt-4 pb-24 md:px-8 md:pt-8 md:pb-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <BottomNav />
    </div>
  )
}
