/**
 * Punto rojo con ondas y "Con animales", dentro de la tarjeta de un lote. Es
 * un dato más de la tarjeta, no una alerta: el texto va en el gris de la
 * tarjeta y sólo el punto lleva color.
 *
 * `simulado`: lo marcó el GPS simulado del mapa, no una jornada cargada. Se dice
 * siempre, porque esa posición es de la demo y no un dato real de campo.
 *
 * Las ondas son dos anillos desfasados; con "reducir movimiento" activado en el
 * sistema quedan quietas y el punto sigue visible.
 */
export default function IndicadorConAnimales({ simulado = false, grande = false }: { simulado?: boolean; grande?: boolean }) {
  // `grande`: la versión destacada de la card del ganado, en Lotes. Es lo
  // primero que tiene que verse: pastilla roja suave, punto y texto grandes.
  if (grande) {
    return (
      <span className="inline-flex items-center gap-2.5 rounded-full border border-red-200 bg-red-50 py-1.5 pr-3.5 pl-2.5">
        <span aria-hidden="true" className="relative flex size-4 flex-none">
          <span className="absolute inset-0 rounded-full bg-red-500 opacity-60 motion-safe:animate-ping" />
          <span className="absolute inset-0 rounded-full bg-red-500 opacity-40 motion-safe:animate-ping motion-safe:[animation-delay:700ms]" />
          <span className="relative size-4 rounded-full bg-red-600 shadow-[0_0_0_2px_white]" />
        </span>
        <span className="text-[1.05rem] font-bold tracking-[-0.01em] text-red-800">Con animales</span>
        {simulado && <span className="text-[0.72rem] font-medium text-red-700/70">· GPS simulado</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-medium text-gray-600">
      <span aria-hidden="true" className="relative flex size-2.5 flex-none">
        <span className="absolute inset-0 rounded-full bg-red-500 opacity-60 motion-safe:animate-ping" />
        <span className="absolute inset-0 rounded-full bg-red-500 opacity-40 motion-safe:animate-ping motion-safe:[animation-delay:700ms]" />
        <span className="relative size-2.5 rounded-full bg-red-600" />
      </span>
      Con animales
      {simulado && <span className="text-gray-400">· GPS simulado</span>}
    </span>
  );
}