/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 静かなダークテーマ用カラーパレット
        bg: {
          DEFAULT: '#050509', // Deepest black-blue
          surface: '#0b0b10', // Slightly lighter background
          panel: '#13131a',   // Card/Panel background
        },
        accent: {
          DEFAULT: '#3b82f6', // Primary Blue
          dim: 'rgba(59, 130, 246, 0.1)',
          glow: 'rgba(59, 130, 246, 0.5)',
        },
        text: {
          main: '#e2e8f0',
          muted: '#94a3b8',
          dim: '#475569',
        },
        border: {
          DEFAULT: '#1e293b',
          light: '#334155',
        }
      },
      fontFamily: {
        // 見出し用: Space Grotesk (Tech/Retro-future feel)
        heading: ['"Space Grotesk"', 'sans-serif'],
        // 本文用: Manrope (Clean, Readable)
        body: ['"Manrope"', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px -5px rgba(59, 130, 246, 0.3)',
      }
    },
  },
  plugins: [],
}
