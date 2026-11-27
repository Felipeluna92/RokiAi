'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LayoutDashboard, Search, Users, Receipt, Briefcase, Settings, MoreHorizontal, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/app/login/actions'

const MAIN = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/prospectar', label: 'Prospectar', icon: Search },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/cobrancas', label: 'Cobranças', icon: Receipt },
]
const MORE = [
  { href: '/clientes', label: 'Clientes', icon: Briefcase },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

function isActive(path: string, href: string) {
  return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`)
}

export function SideNav() {
  const path = usePathname()
  return (
    <nav aria-label="Menu lateral" className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-zinc-200 bg-white p-3 md:flex dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 px-3 pt-2 text-xl font-bold">RokiAi</div>
      {[...MAIN.slice(0, 3), MORE[0], MAIN[3], MORE[1]].map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
            isActive(path, href) && 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white',
          )}
        >
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
      <form action={signOut} className="mt-auto">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </form>
    </nav>
  )
}

export function BottomNav() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const item = 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium'
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute right-2 bottom-20 w-52 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            {MORE.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <Icon className="h-4 w-4" /> {label}
              </Link>
            ))}
            <form action={signOut}>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </form>
          </div>
        </div>
      )}
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-zinc-800 dark:bg-zinc-900">
        {MAIN.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cn(item, isActive(path, href) ? 'text-zinc-900 dark:text-white' : 'text-zinc-500')}>
            <Icon className="h-5 w-5" /> {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(item, MORE.some((m) => isActive(path, m.href)) ? 'text-zinc-900 dark:text-white' : 'text-zinc-500')}
        >
          <MoreHorizontal className="h-5 w-5" /> Mais
        </button>
      </nav>
    </>
  )
}
