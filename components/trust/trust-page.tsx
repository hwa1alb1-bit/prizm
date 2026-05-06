import type { ReactNode } from 'react'

export function TrustPage({
  eyebrow = 'PRIZM Trust',
  title,
  intro,
  children,
}: {
  eyebrow?: string
  title: string
  intro: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-foreground/50">{eyebrow}</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-foreground/70">{intro}</p>
      <div className="mt-10 space-y-10">{children}</div>
    </main>
  )
}

export function TrustSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-foreground/10 pt-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4 text-sm leading-6 text-foreground/70">{children}</div>
    </section>
  )
}
