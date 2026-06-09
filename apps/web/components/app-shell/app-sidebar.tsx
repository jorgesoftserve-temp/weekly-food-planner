'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ChefHat,
  CalendarRange,
  ShoppingCart,
  LayoutDashboard,
  Users,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useActiveWorkspace } from '@/components/workspace-provider'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/members', label: 'Members', icon: Users },
  { href: '/recipes', label: 'Recipes', icon: ChefHat },
  { href: '/menu', label: 'Weekly menu', icon: CalendarRange },
  { href: '/grocery', label: 'Grocery list', icon: ShoppingCart },
] as const

export const AppSidebar = () => {
  const pathname = usePathname()
  const { workspace } = useActiveWorkspace()

  const isActive = (href: string): boolean =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ChefHat className="size-4" />
          </div>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">
              {workspace?.name ?? 'Weekly Food Planner'}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {workspace?.type === 'group' ? 'Group workspace' : 'Personal'}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Plan</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_LINKS.map((link) => {
                const Icon = link.icon
                const active = isActive(link.href)
                return (
                  <SidebarMenuItem key={link.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={link.label}
                      // Active item reflects the user's chosen accent (tint bg +
                      // strong text) — see docs/design/user-accent-colors.md.
                      className={cn(
                        active &&
                          'bg-accent-tint text-accent-strong hover:bg-accent-tint hover:text-accent-strong data-[active=true]:bg-accent-tint data-[active=true]:text-accent-strong',
                      )}
                    >
                      <Link href={link.href}>
                        <Icon />
                        <span>{link.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
