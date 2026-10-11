import type { Config } from 'tailwindcss'

// Dispatch Deck palette, drawn from the Office's Neo Edo Steam theme so the dashboard, the
// popover and the Office HUD share one world. Names the HUD already uses keep working.
const NIGHT = '#121629'
const PLATE = '#1B2140'
const PLATE_RAISED = '#262D54'
const PLATE_LINE = '#353D6C'
const BRASS = '#B08D57'
const BRASS_LINE = '#7A6748'
const LANTERN = '#FFC46B'
const PATINA = '#5FD3C4'
const WASHI = '#EFE6D2'
const PAPER_SHADE = '#D9CCAE'
const MIST = '#B3B9D6'
const MIST_QUIET = '#8F97BC'

const config: Config = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: NIGHT,
          rail: '#171C36',
          raised: PLATE,
          hover: PLATE_RAISED
        },
        // Lantern: tokens, the primary action and the focus ring.
        accent: {
          DEFAULT: LANTERN,
          bright: '#FFD28E',
          hot: '#FFF0D2',
          // The HUD's primary buttons put white text on this one (6.1:1), so it stays dark.
          hover: '#7A5E2A',
          subtle: 'rgba(255, 196, 107, 0.15)',
          muted: 'rgba(255, 196, 107, 0.12)',
          ring: 'rgba(255, 196, 107, 0.4)'
        },
        status: {
          active: PATINA,
          idle: MIST,
          exited: MIST_QUIET,
          finished: MIST
        },
        border: {
          DEFAULT: PLATE_LINE,
          hover: BRASS_LINE,
          // Control edges need 3:1 on a plate; the resting brass line only reaches 2.9:1.
          strong: BRASS
        },
        text: {
          primary: WASHI,
          secondary: MIST,
          tertiary: MIST_QUIET
        },
        brass: {
          DEFAULT: BRASS,
          line: BRASS_LINE
        },
        gold: '#E0B95A',
        // Work orders: the only light surface in the app, reserved for "needs you".
        paper: {
          DEFAULT: WASHI,
          shade: PAPER_SHADE
        },
        ink: {
          DEFAULT: '#1C1A1E',
          soft: '#5A4A3A'
        },
        seal: '#D8432F',
        track: '#2E3560'
      },
      fontFamily: {
        plate: ['DIN Condensed', 'Bahnschrift', 'Arial Narrow', 'sans-serif'],
        sans: ['Avenir Next', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      fontSize: {
        stat: ['2rem', { lineHeight: '1', fontWeight: '700' }],
        count: ['1.375rem', { lineHeight: '1', fontWeight: '700' }],
        title: ['1.125rem', { lineHeight: '1', fontWeight: '700' }],
        heading: ['0.8125rem', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['0.8125rem', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.02em' }],
        'mono-sm': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }]
      },
      borderRadius: {
        card: '6px'
      },
      boxShadow: {
        slip: `inset 0 -2px 0 ${PAPER_SHADE}, 0 4px 10px rgba(4, 6, 16, 0.45)`
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' }
        },
        'slip-drop': {
          from: { opacity: '0', transform: 'translateY(-6px) rotate(-2deg)' },
          to: { opacity: '1', transform: 'translateY(0) rotate(0)' }
        }
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'slip-drop': 'slip-drop 120ms ease-out both'
      }
    }
  },
  plugins: []
}

export default config
