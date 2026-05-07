import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  safelist: [
    ...['primary', 'coral', 'sky', 'purple'].flatMap(c => [
      `bg-${c}`, `text-${c}`, `border-${c}`,
      `bg-${c}/5`, `bg-${c}/10`, `bg-${c}/20`, `bg-${c}/30`,
      `border-${c}/20`, `border-${c}/30`, `border-${c}/50`,
      `text-${c}`,
    ]),
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        body: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        korean: ['"Cafe24Ssurround"', 'Pretendard', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Brand colors from logo
        coral: {
          DEFAULT: "hsl(var(--coral))",
          light: "hsl(var(--coral-light))",
          dark: "hsl(var(--coral-dark))",
        },
        magenta: "hsl(var(--magenta))",
        purple: {
          DEFAULT: "hsl(var(--purple))",
          light: "hsl(var(--purple-light))",
          dark: "hsl(var(--purple-dark))",
        },
        sky: {
          DEFAULT: "hsl(var(--sky))",
          light: "hsl(var(--sky-light))",
          dark: "hsl(var(--sky-dark))",
        },
        // Legacy compatibility
        gold: {
          DEFAULT: "hsl(var(--gold))",
          light: "hsl(var(--gold-light))",
          dark: "hsl(var(--gold-dark))",
        },
        cream: "hsl(var(--cream))",
        charcoal: "hsl(var(--charcoal))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "sparkle": {
          "0%, 100%": {
            opacity: "0",
            transform: "scale(0) rotate(0deg)"
          },
          "50%": {
            opacity: "1",
            transform: "scale(1.3) rotate(180deg)"
          }
        },
        "twinkle": {
          "0%, 100%": {
            opacity: "0.1",
            transform: "scale(0.3)"
          },
          "50%": {
            opacity: "1",
            transform: "scale(1)"
          }
        },
        "float": {
          "0%, 100%": {
            transform: "translateY(0px) translateX(0px)"
          },
          "25%": {
            transform: "translateY(-25px) translateX(15px)"
          },
          "50%": {
            transform: "translateY(-12px) translateX(-12px)"
          },
          "75%": {
            transform: "translateY(-35px) translateX(8px)"
          }
        },
        "particle-rise": {
          "0%": {
            opacity: "0",
            transform: "translateY(100%) scale(0)"
          },
          "10%": {
            opacity: "0.9"
          },
          "90%": {
            opacity: "0.9"
          },
          "100%": {
            opacity: "0",
            transform: "translateY(-100vh) scale(1.3)"
          }
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(-24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-brand": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsla(280, 70%, 55%, 0.4)" },
          "50%": { boxShadow: "0 0 0 12px hsla(280, 70%, 55%, 0)" },
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "gradient-flow": {
          "0%": { filter: "hue-rotate(0deg)" },
          "50%": { filter: "hue-rotate(15deg)" },
          "100%": { filter: "hue-rotate(0deg)" },
        },
        "card-flip-to-back": {
          "0%": { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(180deg)" },
        },
        "card-flip-to-front": {
          "0%": { transform: "rotateY(180deg)" },
          "100%": { transform: "rotateY(0deg)" },
        },
      },
      animation: {
        "sparkle": "sparkle 1s ease-in-out infinite",
        "twinkle": "twinkle var(--twinkle-duration, 1.2s) ease-in-out var(--twinkle-delay, 0s) infinite",
        "float": "float 4s ease-in-out infinite",
        "particle-rise": "particle-rise 5s ease-in-out infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.6s ease-out forwards",
        "fade-in-up": "fade-in-up 0.8s ease-out forwards",
        "slide-in-right": "slide-in-right 0.6s ease-out forwards",
        "scale-in": "scale-in 0.5s ease-out forwards",
        "pulse-brand": "pulse-brand 2s infinite",
        "gradient-shift": "gradient-shift 3s ease infinite",
        "gradient-flow": "gradient-flow 4s ease-in-out infinite",
        "card-flip-to-back": "card-flip-to-back 0.6s ease-in-out forwards",
        "card-flip-to-front": "card-flip-to-front 0.6s ease-in-out forwards",
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, hsl(10 85% 65%) 0%, hsl(330 75% 55%) 35%, hsl(280 70% 55%) 65%, hsl(200 85% 55%) 100%)",
        "gradient-coral": "linear-gradient(135deg, hsl(10 85% 65%) 0%, hsl(330 75% 55%) 100%)",
        "gradient-purple": "linear-gradient(135deg, hsl(280 70% 55%) 0%, hsl(280 75% 40%) 100%)",
        "gradient-sky": "linear-gradient(135deg, hsl(200 85% 55%) 0%, hsl(280 70% 55%) 100%)",
        "gradient-dark": "linear-gradient(135deg, hsl(260 40% 15%) 0%, hsl(280 35% 22%) 100%)",
        "gradient-hero": "linear-gradient(180deg, hsl(0 0% 100%) 0%, hsl(270 30% 98%) 100%)",
        "gradient-overlay": "linear-gradient(180deg, hsla(0 0% 0% / 0) 0%, hsla(260 50% 10% / 0.6) 100%)",
        // Legacy
        "gradient-gold": "linear-gradient(135deg, hsl(10 85% 65%) 0%, hsl(330 75% 55%) 100%)",
      },
      boxShadow: {
        "sm": "0 2px 8px hsla(280, 70%, 55%, 0.06)",
        "md": "0 8px 24px hsla(280, 70%, 55%, 0.12)",
        "lg": "0 16px 48px hsla(280, 70%, 55%, 0.16)",
        "brand": "0 8px 32px hsla(280, 70%, 55%, 0.3)",
        "gold": "0 8px 32px hsla(280, 70%, 55%, 0.25)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
