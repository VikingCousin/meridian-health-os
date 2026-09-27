import { cn } from "@/lib/utils";

export function PageContainer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pt-10", className)}
      {...props}
    />
  );
}
