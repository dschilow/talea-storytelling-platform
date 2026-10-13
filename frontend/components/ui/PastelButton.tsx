import React from "react";
import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";

interface PastelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "accent" | "ghost";
    size?: "sm" | "md" | "lg" | "icon";
    asChild?: boolean;
}

export const PastelButton = React.forwardRef<HTMLButtonElement, PastelButtonProps>(
    ({ className, variant = "primary", size = "md", asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";

        return (
            <Comp
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold ring-offset-background transition-[background-color,color,filter,box-shadow,transform] duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    "motion-safe:active:scale-[0.98] hover:shadow-md",

                    // Variants
                    variant === "primary" && "[background:var(--talea-gradient-brand)] text-primary-foreground hover:brightness-[1.04] shadow-primary/20",
                    variant === "secondary" && "bg-secondary text-secondary-foreground hover:brightness-[1.04] shadow-secondary/20",
                    variant === "accent" && "bg-accent text-accent-foreground hover:brightness-[1.04] shadow-accent/20",
                    variant === "ghost" && "hover:bg-accent/10 hover:text-accent-foreground",

                    // Sizes
                    size === "sm" && "min-h-11 px-4 py-2",
                    size === "md" && "min-h-12 px-6 py-3 text-base",
                    size === "lg" && "min-h-14 px-8 py-3.5 text-lg",
                    size === "icon" && "h-11 w-11",

                    className
                )}
                {...props}
            />
        );
    }
);
PastelButton.displayName = "PastelButton";
