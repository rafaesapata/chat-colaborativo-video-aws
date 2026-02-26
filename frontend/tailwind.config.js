/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(200, 100%, 52%)',
          glow: 'hsl(200, 100%, 68%)',
          50: 'hsl(200, 100%, 96%)',
          100: 'hsl(200, 100%, 90%)',
          200: 'hsl(200, 100%, 80%)',
          300: 'hsl(200, 100%, 68%)',
          400: 'hsl(200, 100%, 60%)',
          500: 'hsl(200, 100%, 52%)',
          600: 'hsl(200, 100%, 44%)',
          700: 'hsl(200, 100%, 36%)',
          800: 'hsl(200, 100%, 28%)',
          900: 'hsl(200, 100%, 20%)',
        },
        surface: {
          light: 'hsl(220, 30%, 98%)',
          dark: 'hsl(220, 25%, 8%)',
        },
        card: {
          light: '#ffffff',
          dark: 'hsl(220, 22%, 12%)',
        },
        foreground: {
          light: 'hsl(220, 20%, 10%)',
          dark: 'hsl(220, 15%, 96%)',
        },
        muted: {
          light: 'hsl(220, 12%, 45%)',
          dark: 'hsl(220, 12%, 65%)',
        },
        border: {
          light: 'hsl(220, 18%, 90%)',
          dark: 'hsl(220, 22%, 18%)',
        },
        success: 'hsl(142, 71%, 45%)',
        warning: 'hsl(38, 92%, 50%)',
        destructive: 'hsl(0, 85%, 60%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['9px', { lineHeight: '1.1' }],
        'xs': ['11px', { lineHeight: '1.1' }],
        'sm': ['12px', { lineHeight: '1.2' }],
        'base': ['13px', { lineHeight: '1.3' }],
        'lg': ['14px', { lineHeight: '1.3' }],
        'xl': ['16px', { lineHeight: '1.3' }],
        '2xl': ['18px', { lineHeight: '1.2' }],
        '3xl': ['21px', { lineHeight: '1.2' }],
        '4xl': ['26px', { lineHeight: '1.1' }],
      },
      borderRadius: {
        'DEFAULT': '0.42rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      spacing: {
        '13': '3.25rem',
        '30': '7.5rem',
        '90': '22.5rem',
      },
      boxShadow: {
        'glass': '0 4px 24px -4px rgba(0,0,0,0.08), 0 2px 8px -2px rgba(0,0,0,0.04)',
        'glass-hover': '0 12px 48px -8px hsl(200 100% 50% / 0.25), 0 0 0 1px hsl(200 100% 70% / 0.4)',
        'glass-dark': '0 4px 24px -4px rgba(0,0,0,0.3), 0 2px 8px -2px rgba(0,0,0,0.2)',
        'glass-dark-hover': '0 12px 48px -8px hsl(200 100% 50% / 0.35), 0 0 0 1px hsl(200 100% 70% / 0.3)',
        'glow': '0 0 16px hsl(200 100% 60% / 0.4)',
        'glow-lg': '0 0 32px hsl(200 100% 60% / 0.3)',
        'inner-highlight': 'inset 0 1px 0 0 rgba(255,255,255,0.06)',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        '350': '350ms',
      },
      backdropBlur: {
        '12': '12px',
        '16': '16px',
      },
      animation: {
        'fade-in': 'fadeIn 400ms ease-out',
        'fade-in-up': 'fadeInUp 500ms ease-out both',
        'fade-in-down': 'fadeInDown 400ms ease-out both',
        'fade-in-scale': 'fadeInScale 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'slide-in-right': 'slideInRight 350ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'slide-in-left': 'slideInLeft 350ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'message-enter': 'messageEnter 200ms ease-out',
        'participant-enter': 'participantEnter 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        'skeleton-shimmer': 'skeletonShimmer 1.5s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'stagger-1': 'fadeInUp 400ms ease-out 50ms both',
        'stagger-2': 'fadeInUp 400ms ease-out 100ms both',
        'stagger-3': 'fadeInUp 400ms ease-out 150ms both',
        'stagger-4': 'fadeInUp 400ms ease-out 200ms both',
        'stagger-5': 'fadeInUp 400ms ease-out 250ms both',
      },
      keyframes: {
        fadeIn: {
          'from': { opacity: '0', transform: 'translateY(10px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInUp: {
          'from': { opacity: '0', transform: 'translateY(12px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          'from': { opacity: '0', transform: 'translateY(-12px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInScale: {
          'from': { opacity: '0', transform: 'scale(0.95)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          'from': { opacity: '0', transform: 'translateX(20px)' },
          'to': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          'from': { opacity: '0', transform: 'translateX(-20px)' },
          'to': { opacity: '1', transform: 'translateX(0)' },
        },
        messageEnter: {
          'from': { opacity: '0', transform: 'translateY(10px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        participantEnter: {
          'from': { opacity: '0', transform: 'scale(0.8)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
        skeletonShimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 16px hsl(200 100% 60% / 0.3)' },
          '50%': { boxShadow: '0 0 24px hsl(200 100% 60% / 0.5)' },
        },
      },
    },
  },
  plugins: [],
}
