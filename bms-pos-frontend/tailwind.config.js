/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 1. Nombres Genéricos (Marca Blanca) - Úsalos si creas nuevos componentes a futuro
        'primary': 'rgb(var(--color-primary) / <alpha-value>)',
        'accent': 'rgb(var(--color-accent) / <alpha-value>)',
        'brand-bg': 'rgb(var(--color-bg) / <alpha-value>)',

        // 2. Alias de Compatibilidad (El puente mágico ✨)
        // Esto evita que tengas que cambiar las clases en tus 20+ archivos. 
        // Ahora "higea-blue" leerá automáticamente la variable del cliente.
        'higea-blue': 'rgb(var(--color-primary) / <alpha-value>)', // Azul Institucional dinámico
        'higea-red': 'rgb(var(--color-accent) / <alpha-value>)',  // Rojo Institucional dinámico
        'higea-bg': 'rgb(var(--color-bg) / <alpha-value>)',   
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'], // <--- AQUÍ ESTÁ EL CAMBIO CLAVE
      }
    },
  },
  plugins: [],
}