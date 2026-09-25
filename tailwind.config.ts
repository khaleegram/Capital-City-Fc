import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: {DEFAULT: '1.25rem', md: '2rem'},
      screens: {'2xl': '1320px'},
    },
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        headline: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        code: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Fixed brand constants. These mean the same thing in every context.
        ink: '#07142E',
        navy: {
          DEFAULT: '#13295B',
          soft: '#1E3A74',
          deep: '#0B1D42',
        },
        /*
         * Contextual tokens. Each resolves through a CSS variable and flips inside
         * `.on-dark`, so navy bands and photo scrims need no per-class overrides.
         */
        ivory: 'rgb(var(--brand-fg) / <alpha-value>)', // primary text
        mist: 'rgb(var(--brand-muted) / <alpha-value>)', // secondary text
        line: 'rgb(var(--brand-line) / <alpha-value>)', // hairlines and faint fills
        paper: 'rgb(var(--brand-surface) / <alpha-value>)', // raised surfaces
        canvas: 'rgb(var(--brand-canvas) / <alpha-value>)', // page ground
        signal: {
          DEFAULT: 'rgb(var(--brand-accent) / <alpha-value>)',
          soft: 'rgb(var(--brand-accent-soft) / <alpha-value>)',
          foreground: 'rgb(var(--brand-accent-fg) / <alpha-value>)',
        },
        live: {
          DEFAULT: 'rgb(var(--brand-live) / <alpha-value>)',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      letterSpacing: {
        stamp: '0.22em',
      },
      keyframes: {
        'accordion-down': {
          from: {height: '0'},
          to: {height: 'var(--radix-accordion-content-height)'},
        },
        'accordion-up': {
          from: {height: 'var(--radix-accordion-content-height)'},
          to: {height: '0'},
        },
        'route-dash': {
          to: {strokeDashoffset: '-24'},
        },
        'live-pulse': {
          '0%, 100%': {opacity: '1', transform: 'scale(1)'},
          '50%': {opacity: '0.35', transform: 'scale(1.6)'},
        },
        marquee: {
          from: {transform: 'translateX(0)'},
          to: {transform: 'translateX(-50%)'},
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'route-dash': 'route-dash 1.2s linear infinite',
        'live-pulse': 'live-pulse 1.6s ease-in-out infinite',
        marquee: 'marquee 40s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
