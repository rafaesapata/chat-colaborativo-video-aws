/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '13': '3.25rem',
        '30': '7.5rem',
        '90': '22.5rem',
      },
      transitionDuration: {
        '350': '350ms',
      },
      backdropBlur: {
        '12': '12px',
      },
      animation: {
        'fade-in': 'fadeIn 400ms ease-out',
        'message-enter': 'messageEnter 200ms ease-out',
        'participant-enter': 'participantEnter 400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        fadeIn: {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        messageEnter: {
          'from': { opacity: '0', transform: 'translateY(10px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        participantEnter: {
          'from': { opacity: '0', transform: 'scale(0.8)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
