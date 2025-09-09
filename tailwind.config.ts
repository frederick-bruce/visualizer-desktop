import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#121212',
        card: '#181818',
        accent: '#1DB954', // Spotify-ish green
      },
    },
  },
  plugins: [],
} satisfies Config
