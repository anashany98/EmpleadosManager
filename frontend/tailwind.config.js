/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            // ============== SaaS Premium Color Palette ==============
            colors: {
                // Primary accent - Violeta
                brand: {
                    50: '#f5f3ff',
                    100: '#ede9fe',
                    200: '#ddd6fe',
                    300: '#c4b5fd',
                    400: '#a78bfa',
                    500: '#8b5cf6',
                    600: '#7c3aed',
                    700: '#6d28d9',
                    800: '#5b21b6',
                    900: '#4c1d95',
                },
                // Secondary accent - Cian
                accent: {
                    50: '#ecfeff',
                    100: '#cffafe',
                    200: '#a5f3fc',
                    300: '#67e8f3',
                    400: '#22d3ee',
                    500: '#06b6d4',
                    600: '#0891b2',
                    700: '#0e7490',
                    800: '#155e75',
                    900: '#164e63',
                },
                // Dark backgrounds (for dark mode)
                dark: {
                    bg: '#020617',      // slate-950 - main bg
                    card: '#0f172a',  // slate-900 - card bg
                    border: '#1e293b',  // slate-800 - borders
                    hover: '#1e293b',   // hover states
                },
                // Light backgrounds (for light mode)
                light: {
                    bg: '#f8fafc',    // slate-50
                    card: '#ffffff',   // white
                    border: '#e2e8f0', // slate-200
                }
            },
            // ============== Typography ==============
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Inter', 'system-ui', 'sans-serif'],
            },
            // ============== Border Radius ==============
            borderRadius: {
                'xs': '0.125rem',  // 2px
                'sm': '0.25rem',  // 4px
                'md': '0.375rem', // 6px
                'lg': '0.5rem',  // 8px
                'xl': '0.75rem',  // 12px
                '2xl': '1rem',    // 16px
            },
            // ============== Box Shadow ==============
            boxShadow: {
                'soft': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                'elevated': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                'glow': '0 0 20px -5px rgb(124 58 237 / 0.5)', // violeta glow
            },
            // ============== Animation ==============
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-down': 'slideDown 0.3s ease-out',
                'scale-in': 'scaleIn 0.2s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideDown: {
                    '0%': { transform: 'translateY(-10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
            },
            // ============== Spacing ==============
            spacing: {
                '18': '4.5rem',  // 72px
                '22': '5.5rem',  // 88px
            },
        },
    },
    plugins: [],
}