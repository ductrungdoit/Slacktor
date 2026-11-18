import { CONTACT_EMAIL, ISSUES_URL, REPOSITORY_URL } from "@slacktor/ui"
import { cn } from "cn"
import type { ReactNode } from "react"

import { getPageHref, SITE_PAGES, type SitePageId } from "../pages"

type SiteLayoutProps = {
  activePage: SitePageId
  children: ReactNode
}

export function SiteLayout({ activePage, children }: SiteLayoutProps) {
  const logoSrc = `${import.meta.env.BASE_URL}icons/icon-128.png`

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
          <a
            href={import.meta.env.BASE_URL}
            className="focus-visible:ring-ring/50 flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px]"
          >
            <img src={logoSrc} alt="" width={32} height={32} className="size-8 rounded-lg" />
            <span className="text-[17px] font-semibold tracking-tight">Slacktor</span>
          </a>

          <nav aria-label="Main" className="-mx-2 overflow-x-auto">
            <ul className="flex items-center gap-1 text-sm">
              {SITE_PAGES.map((page) => {
                const active = page.id === activePage
                return (
                  <li key={page.id}>
                    <a
                      href={getPageHref(page)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "focus-visible:ring-ring/50 block rounded-md px-2.5 py-1.5 font-medium whitespace-nowrap outline-none focus-visible:ring-[3px]",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {page.navLabel}
                    </a>
                  </li>
                )
              })}
              <li>
                <a
                  href={REPOSITORY_URL}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 block rounded-md px-2.5 py-1.5 font-medium whitespace-nowrap outline-none focus-visible:ring-[3px]"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="bg-muted/60 border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            Slacktor is an independent project, not affiliated with Slack Technologies or
            Salesforce.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <a
                className="hover:text-foreground underline-offset-4 hover:underline"
                href={ISSUES_URL}
              >
                Report an issue
              </a>
            </li>
            <li>
              <a
                className="hover:text-foreground underline-offset-4 hover:underline"
                href={`mailto:${CONTACT_EMAIL}`}
              >
                Contact
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  )
}

type PageHeaderProps = {
  title: string
  children?: ReactNode
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-14 pb-8 sm:px-8 sm:pt-20">
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        {title}
      </h1>
      {children ? (
        <div className="text-muted-foreground mt-4 max-w-2xl text-lg text-pretty">{children}</div>
      ) : null}
    </div>
  )
}
