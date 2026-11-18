export default function App() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-void px-6 font-mono text-neon-green">
      {/* Fondo: cuadrícula, resplandores y scanlines */}
      <div className="grid-bg pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-neon-purple/30 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-neon-blue/25 blur-[120px]" />
      <div className="scanlines pointer-events-none absolute inset-0" />

      <section className="relative z-10 max-w-4xl text-center">
        <p className="mb-6 text-xs tracking-[0.5em] text-neon-blue sm:text-sm">
          // ポートフォリオ · SISTEMA EN LÍNEA
        </p>

        <h1
          data-text="Hola, soy el portafolio de Sebastián"
          className="glitch font-display text-4xl font-extrabold uppercase leading-tight sm:text-6xl"
        >
          Hola, soy el portafolio de Sebastián
        </h1>

        <div className="mx-auto mt-8 h-px w-48 bg-gradient-to-r from-transparent via-neon-purple to-transparent shadow-[0_0_12px_#b026ff]" />

        <p className="mt-6 text-neon-purple">
          &gt; ようこそ<span className="cursor">_</span>
        </p>
      </section>
    </main>
  );
}
