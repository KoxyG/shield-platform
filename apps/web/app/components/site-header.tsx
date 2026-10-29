import { ShieldCheckIcon } from "@phosphor-icons/react"
import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { Link, NavLink } from "react-router"

import { ModeSwitcher } from "@/components/mode-switcher"

const navLink =
  "rounded-full px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-headline font-semibold tracking-tight"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ShieldCheckIcon weight="fill" className="size-4.5" />
          </span>
          ShieldZK
        </Link>

        <nav className="hidden items-center gap-1 text-label md:flex">
          <Link
            to="/#how-it-works"
            className={cn(navLink, "text-muted-foreground")}
          >
            How it works
          </Link>
          <NavLink
            to="/batches"
            className={({ isActive }) =>
              cn(
                navLink,
                isActive
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              )
            }
          >
            Batches
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Badge variant="outline" className="hidden sm:inline-flex">
            Stellar testnet
          </Badge>
          <ModeSwitcher />
          <Link
            to="/batches/new"
            className={cn(buttonVariants({ size: "lg" }), "rounded-full px-4")}
          >
            New batch
          </Link>
        </div>
      </div>
    </header>
  )
}
