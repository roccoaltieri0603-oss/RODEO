import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import { obtenerEstimacionForraje, type EstimacionForraje } from "../api/estimacion";
import { progresoRegeneracion, resumirCondicion } from "../estimacion/presentacion";
import type { Lote } from "../types";
import BloquesRegeneracion from "./BloquesRegeneracion";
import MiniaturaLote from "./MiniaturaLote";
import FraseConAyuda from "./ui/FraseConAyuda";

/**
 * Lo que se despliega dentro de la card de un lote al seleccionarlo: el mismo
 * bloque oscuro que abre la ficha (condición, porcentaje del estado foliar y
 * diez bloques de rebrote) con la miniatura del lote a la derecha, en chico.
 * La estimación se pide recién al abrirlo. Sin estimación no se dibujan bloques:
 * se dice "sin datos" y por qué.
 */
function hoy(): string {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
}

/** Última estimación de cada lote en esta sesión: al reabrir una card se muestra al instante y se refresca por detrás. */
const ultimaEstimacion = new Map<string, EstimacionForraje>();
const claveDe = (establecimientoId: string, lote: Lote) => `${establecimientoId}:${lote.id}:${lote.tipoPastura ?? ""}`;

export default function LoteExpandido({ establecimientoId, lote }: { establecimientoId: string; lote: Lote }) {
  const [abierto, setAbierto] = useState(false);
  const [estimacion, setEstimacion] = useState<EstimacionForraje | null>(() => ultimaEstimacion.get(claveDe(establecimientoId, lote)) ?? null);
  const [cargando, setCargando] = useState(() => !ultimaEstimacion.has(claveDe(establecimientoId, lote)));
  const [error, setError] = useState<string | null>(null);

  // Un cuadro después de montar, para que la altura se anime de 0 a su tamaño.
  useEffect(() => {
    const cuadro = window.requestAnimationFrame(() => setAbierto(true));
    return () => window.cancelAnimationFrame(cuadro);
  }, []);

  useEffect(() => {
    let vigente = true;
    const clave = claveDe(establecimientoId, lote);
    const guardada = ultimaEstimacion.get(clave) ?? null;
    setEstimacion(guardada);
    setCargando(guardada === null);
    setError(null);
    obtenerEstimacionForraje(establecimientoId, lote.id)
      .then((resultado) => { ultimaEstimacion.set(clave, resultado); if (vigente) setEstimacion(resultado); })
      .catch((motivo: unknown) => { if (vigente && !guardada) setError(motivo instanceof ApiError ? motivo.message : "No se pudo calcular la estimación."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [establecimientoId, lote.id, lote.tipoPastura]);

  const resumen = useMemo(() => resumirCondicion(lote, estimacion, hoy()), [lote, estimacion]);
  const progreso = progresoRegeneracion(estimacion?.reingreso, undefined);
  const motivo = error ?? estimacion?.mensaje ?? estimacion?.reingreso?.mensaje ?? "Hace falta el tipo de pastura, el clima y el último pastoreo para contar el rebrote.";

  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${abierto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      onClick={(evento) => evento.stopPropagation()}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-[var(--color-campo-900)] p-3.5 text-white">
          <div className="flex items-stretch gap-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="m-0 text-[0.62rem] font-semibold tracking-[0.1em] text-white/60 uppercase">Condición para pastorear</p>
              {resumen.prefijo && <p className="m-0 mt-1 text-[0.72rem] text-white/75">{resumen.prefijo}</p>}
              <p className="m-0 mt-1 text-[1.2rem] leading-[1.1] font-medium tracking-[-0.02em] text-white">
                {cargando && !estimacion ? "Calculando…" : resumen.titulo}
              </p>
              {!cargando && resumen.frase && (
                <p className="m-0 mt-1.5 text-[0.72rem] leading-[1.35] text-white/75">
                  <FraseConAyuda frase={resumen.frase} ayuda={resumen.ayudaFecha} />
                </p>
              )}
            </div>
            <MiniaturaLote key={lote.id} poligono={lote.polygon} relleno={6} className="miniatura-compacta aspect-[4/3] w-[42%] max-w-[150px] shrink-0 self-start rounded-xl" />
          </div>

          {cargando && !estimacion
            ? <p className="m-0 text-[0.72rem] text-white/60">Calculando la regeneración…</p>
            : progreso !== null
              ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[1.6rem] leading-none font-medium tracking-[-0.03em] text-[var(--color-lima)] tabular-nums">{Math.min(100, Math.round(progreso * 100))}%</span>
                    <span className="text-[0.74rem] text-white/75">del estado foliar óptimo</span>
                  </div>
                  <BloquesRegeneracion progreso={progreso} condicion={resumen.condicion} compacto />
                </div>
              )
              : <p className="m-0 text-[0.72rem] leading-[1.35] text-white/65">Regeneración sin datos. {motivo}</p>}
        </div>
      </div>
    </div>
  );
}
