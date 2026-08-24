import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          subtle: 'hsl(var(--destructive-subtle))',
          'subtle-foreground': 'hsl(var(--destructive-subtle-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        // Semantic status palette — shared across the whole app for any active/warning/
        // critical/informational state (badges, alert banners, table row indicators, etc).
        // Kept as design tokens (not one-off Tailwind classes) so `system_alerts` severity
        // (info / warning / critical) and general status fields (active/expired/...) render
        // consistently everywhere, not just wherever someone remembered the right shade.
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          subtle: 'hsl(var(--success-subtle))',
          'subtle-foreground': 'hsl(var(--success-subtle-foreground))'
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          subtle: 'hsl(var(--warning-subtle))',
          'subtle-foreground': 'hsl(var(--warning-subtle-foreground))'
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
          subtle: 'hsl(var(--info-subtle))',
          'subtle-foreground': 'hsl(var(--info-subtle-foreground))'
        }
      },
      borderRadius: {
        // Carbon: sudut tajam di mana-mana (radius 0) — --radius tetap ada di
        // globals.css sebagai token, tapi di-hardcode 0px di sini (bukan
        // calc(var(--radius) - Npx)) supaya tidak menghasilkan nilai negatif
        // yang jadi invalid CSS kalau --radius diset 0.
        //
        // SELURUH anak tangga ditimpa, bukan hanya lg/md/sm — inilah akar sudut membulat
        // yang bertahan setelah "perbaikan" 25 Agu 2026. Skala bawaan Tailwind punya
        // SEMBILAN anak tangga; versi sebelumnya menimpa TIGA, dan enam sisanya diam-diam
        // tetap memakai nilai Tailwind. Diukur dari CSS yang benar-benar dipancarkan:
        //   .rounded 0.25rem | .rounded-xl 0.75rem | .rounded-2xl 1rem | .rounded-3xl 1.5rem
        // Kode ini memakai empat di antaranya di 34 tempat, terbanyak di halaman
        // login/daftar/lupa-sandi — layar yang paling sering dilihat.
        //
        // PELAJARANNYA, supaya tidak terulang: memeriksa anak tangga yang DIPAKAI lalu
        // menyimpulkan seluruh skalanya nol adalah kesimpulan yang lebih luas daripada
        // buktinya. Yang membuktikan bukan membaca config, melainkan MENGUKUR CSS keluaran.
        //
        // `full` SENGAJA tidak ditimpa: dipakai foto profil dan titik lonceng notifikasi,
        // yang memang bulat dan bukan kontrol bersudut. Tombol berbentuk pil BUKAN termasuk
        // itu — sembilan tombol/tautan pil sudah diubah jadi bersudut tajam.
        DEFAULT: '0px',
        sm: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px'
      },
      fontSize: {
        // Dense/tabular data size — a notch below the default `sm` (14px), for table
        // cells and other data-heavy views where more rows need to fit on screen.
        data: ['0.8125rem', { lineHeight: '1.25rem' }]
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};

export default config;
