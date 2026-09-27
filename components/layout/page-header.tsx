import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div>
        {eyebrow && (
          <p className="flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-accent">
            <span className="h-1 w-1 rounded-full bg-accent" />
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1.5 text-[26px] font-bold tracking-tight text-foreground sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
