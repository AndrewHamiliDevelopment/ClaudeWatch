import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgba(20, 20, 25, 0.85)',
          card: 'rgba(255, 255, 255, 0.05)',
          hover: 'rgba(255, 255, 255, 0.08)'
        },
        accent: {
          DEFAULT: '#7C5CFC',
          hover: '#6B4FE0',
          subtle: 'rgba(124, 92, 252, 0.15)'
        },
        status: {
          active: '#30D158',
          idle: '#FFD60A',
          exited: '#FF453A',
          finished: '#64D2FF'
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          hover: 'rgba(255, 255, 255, 0.15)'
        },
        text: {
          primary: '#E5E5EA',
          secondary: '#8E8E93',
          tertiary: '#636366'
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'system-ui',
          'Segoe UI',
          'sans-serif'
        ],
        mono: ['SF Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      backdropBlur: {
        glass: '20px'
      },
      borderRadius: {
        card: '12px'
      }
    }
  },
  plugins: []
}

export default config
