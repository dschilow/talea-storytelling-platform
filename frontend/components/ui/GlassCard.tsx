import React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    variant?: "default" | "dark" | "interactive";
}

export function GlassCard({
    children,
    className,
    variant = "default",
    ...props
}: GlassCardProps) {
    return (
        <div
            className={cn(
                "rounded-2xl p-6 transition-all duration-300",
                // Base Glass Styles
                "bg-white/60 backdrop-blur-xl border border-white/40 shadow-sm",
                "dark:bg-slate-900/60 dark:border-white/10 dark:shadow-black/20",

                // Interactive Variant (Hover effects)
                variant === "interactive" && [
                    "hover:bg-white/70 hover:scale-[1.02] hover:shadow-md cursor-pointer",
                    "dark:hover:bg-slate-900/70"
                ],

                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}
