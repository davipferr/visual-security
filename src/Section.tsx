import type { ReactNode } from 'react'

export function Section({
  step,
  title,
  aside,
  children,
  intro,
}: {
  step: number
  title: string
  intro: ReactNode
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="card">
      <div className="section-head">
        <span className="step">{step}</span>
        <div className="section-title">
          <h2>{title}</h2>
          <p>{intro}</p>
        </div>
        {aside && <div className="section-aside">{aside}</div>}
      </div>
      {children}
    </section>
  )
}
