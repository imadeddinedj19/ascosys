import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  indeterminate?: boolean;
  className?: string;
  "aria-label"?: string;
};

/** Case à cocher stylée (thème sombre) pour la sélection multiple. */
export function Checkbox({ checked, onChange, indeterminate, className, ...rest }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer",
        checked || indeterminate
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-input hover:border-primary/50",
        className,
      )}
      {...rest}
    >
      {indeterminate ? <Minus className="size-3" /> : checked ? <Check className="size-3" /> : null}
    </button>
  );
}
