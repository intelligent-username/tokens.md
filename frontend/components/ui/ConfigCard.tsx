import type { ReactNode } from "react";

export interface ConfigCardProps {
  title: string;
  children: ReactNode;
  description?: string;
  icon?: ReactNode;
}

/** Labeled glass card grouping related config controls. Purely presentational. */
export function ConfigCard({ title, children, description, icon }: ConfigCardProps) {
  return (
    <section className="glass rounded-card p-5 sm:p-6">
      <header className="mb-1 flex items-center gap-2.5">
        {icon ? (
          <span className="shrink-0 text-emerald-500" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <h3 className="font-display text-base font-bold tracking-tight text-foreground">{title}</h3>
      </header>
      {description ? <p className="mb-4 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}
