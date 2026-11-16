/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0d101d',
        panel: '#151a2d',
        raised: '#1e253b',
        line: '#39435f',
        ink: '#f4f5ff',
        brand: '#bec2ff',
        action: '#d8fc91',
        'action-hover': '#e7ffb6',
        'on-action': '#1c2616',
        // Existing feature utilities share this ramp: lower shades are surfaces,
        // mid shades are readable labels, and 800–950 stay dark for code panes.
        slate: {
          50: '#1c2338', 100: '#2a334b', 200: '#39435f', 300: '#c8cee1',
          400: '#aeb8d2', 500: '#b5bfd8', 600: '#c0c9e1', 700: '#405075',
          800: '#1b2235', 900: '#eef1ff', 950: '#090c16',
        },
        indigo: {
          50: '#252e4c', 100: '#343d62', 200: '#465178', 300: '#aab4ff',
          600: '#aab4ff', 700: '#c3c8ff', 800: '#d0d5ff', 900: '#e1e3ff',
        },
        violet: {
          50: '#28223e', 100: '#3a3055', 200: '#514069', 300: '#d1baff', 900: '#ecddff',
        },
        amber: { 50: '#382c23', 100: '#4b3725', 200: '#6e5438', 300: '#ffe1a5', 600: '#ffcb86', 700: '#ffd398', 800: '#ffdbab', 900: '#ffe3bb' },
        emerald: { 50: '#18352e', 200: '#38604e', 300: '#9bf3c5', 600: '#8ce4b1', 700: '#a4eec3', 800: '#b4f0d0', 900: '#ccf4df' },
        red: { 50: '#3a2431', 100: '#563648', 700: '#ffbccb' },
        sky: { 50: '#1c3046', 600: '#a7dbff' },
      },
      fontFamily: { sans: ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
