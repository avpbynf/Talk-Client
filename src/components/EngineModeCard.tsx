import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface EngineModeCardProps {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: string;
  onClick: () => void;
  children?: React.ReactNode;
}

export function EngineModeCard({
  selected,
  icon,
  title,
  description,
  accentColor,
  onClick,
  children,
}: EngineModeCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-5 rounded-xl border text-left transition-all duration-200",
        !selected && "border-border-card bg-surface-inset hover:bg-card hover:border-border-hover"
      )}
      style={selected ? {
        borderColor: accentColor,
        background: `linear-gradient(to bottom right, color-mix(in oklch, ${accentColor} 15%, transparent), color-mix(in oklch, ${accentColor} 5%, transparent))`,
      } : undefined}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
            !selected && "bg-surface-active text-muted-foreground"
          )}
          style={selected ? {
            backgroundColor: `color-mix(in oklch, ${accentColor} 20%, transparent)`,
            color: accentColor,
          } : undefined}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{title}</span>
            {selected && <Check className="h-4 w-4" style={{ color: accentColor }} />}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </button>
  );
}
