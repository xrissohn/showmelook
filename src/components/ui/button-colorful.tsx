import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

interface ButtonColorfulProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label?: string;
}

export const ButtonColorful = React.forwardRef<HTMLButtonElement, ButtonColorfulProps>(
    ({ className, label = "Explore Components", children, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-medium text-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:shadow-brand hover:scale-[1.02] active:scale-[0.98]",
                    className
                )}
                style={{
                    background: "linear-gradient(135deg, hsl(10 85% 65%) 0%, hsl(330 75% 55%) 35%, hsl(280 70% 55%) 65%, hsl(200 85% 55%) 100%)",
                    backgroundSize: "200% 200%",
                    animation: "gradientMove 3s ease infinite",
                }}
                {...props}
            >
                <span className="relative z-10 flex items-center gap-2">
                    {children || (
                        <>
                            {label}
                            <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </>
                    )}
                </span>
                {/* Animated shine overlay */}
                <span
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 2.5s infinite linear",
                    }}
                />
            </button>
        );
    }
);
ButtonColorful.displayName = "ButtonColorful";
