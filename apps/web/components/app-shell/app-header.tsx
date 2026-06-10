'use client'

import { usePathname } from 'next/navigation'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useActiveWorkspace } from '@/components/workspace-provider'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/recipes': 'Recipes',
  '/menu': 'Weekly menu',
  '/grocery': 'Grocery list',
  '/search': 'Search',
  '/settings': 'Account settings',
}

const currentTitle = (pathname: string): string => {
  // Match the deepest known prefix so detail routes like /recipes/[id]
  // still resolve to "Recipes".
  const match = Object.keys(PAGE_TITLES)
    .filter((key) => pathname === key || pathname.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0]
  return match ? PAGE_TITLES[match]! : 'Weekly Food Planner'
}

export const AppHeader = () => {
  const pathname = usePathname()
  const { workspace } = useActiveWorkspace()
  const title = currentTitle(pathname)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <Breadcrumb>
        <BreadcrumbList>
          {workspace ? (
            <>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbPage className="text-muted-foreground">
                  {workspace.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
            </>
          ) : null}
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
