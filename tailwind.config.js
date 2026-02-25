/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/**/*.{html,ts}',
    ],
    theme: {
        extend: {
            colors: {
                // ── PALETTE "NAVAL GOLD" — White · Navy · Champagne ──────────────
                'arctic-white': '#f2f6fc', // page background (cool white with blue hint)
                'pure-white': '#ffffff', // topbar surface, cards
                'deep-navy': '#1a3462', // topbar bg, calendar header, sidebar
                'navy-mid': '#1e4080', // nav buttons hover, borders on navy
                'royal-blue': '#2d5fa8', // interactive borders on dark surfaces
                'powder-blue': '#ccd8ed', // borders on light surfaces, dividers
                'slate-blue': '#8fa3c8', // muted text, secondary labels
                'ink-navy': '#1a2744', // primary text on light bg
                'champagne': '#c9a96e', // accent primary (gold)
                'champagne-dark': '#b8922a', // accent deep gold
            },
            fontFamily: {
                'dm-sans': ['"DM Sans"', 'sans-serif'],
                'darker-grotesque': ['"Darker Grotesque"', 'sans-serif'],
                'outfit': ['Outfit', 'sans-serif'],
            },
        },
    },
    plugins: [],
};
