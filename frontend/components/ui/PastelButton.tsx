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
                    "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    "active:scale-95 hover:shadow-md",

                    // Variants
                    variant === "primary" && "bg-gradient-to-br from-primary/80 to-primary text-primary-foreground hover:brightness-105 shadow-primary/20",
                    variant === "secondary" && "bg-gradient-to-br from-secondary/80 to-secondary text-secondary-foreground hover:brightness-105 shadow-secondary/20",
                    variant === "accent" && "bg-gradient-to-br from-accent/80 to-accent text-accent-foreground hover:brightness-105 shadow-accent/20",
                    variant === "ghost" && "hover:bg-accent/10 hover:text-accent-foreground",

                    // Sizes
                    size === "sm" && "h-9 px-4 py-2",
                    size === "md" && "h-12 px-6 py-3 text-base",
                    size === "lg" && "h-16 px-8 text-lg rounded-2xl",
                    size === "icon" && "h-10 w-10",

                    className
                )}
                {...props}
            />
        );
    }
);
PastelButton.displayName = "PastelButton";
