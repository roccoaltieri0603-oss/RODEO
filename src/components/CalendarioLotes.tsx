import { Fragment, useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/client";
import { obtenerEstimacionesForraje, type DiaCondicion, type EstimacionForraje } from "../api/estimacion";
import { CONDICION_PASTOREO, esPiso, fechaCorta } from "../estimacion/presentacion";
import { useEstablecimiento } from "../hooks/useEstablecimiento";
import type { EstadoOrdenPastoreo } from "../hooks/useOrdenPastoreo";
import type { CondicionPastoreo } from "../api/estimacion";
import type { Lote } from "../types";
import AvisoInfo from "./ui/AvisoInfo";

/**
 * Colores del calendario: los mismos tonos de la condición, un punto más vivos
 * para que la grilla se lea de un vistazo sin volverse chillona.
 */
const COLOR_CALENDARIO: Record<CondicionPastoreo, string> = {
  perfecto: "#22c55e",
  regular: "#eab308",
  cuidado: "#f97316",
  "no-apto": "#ef4444",
};

function hoy(): string {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
}
const FILAS_CALENDARIO = 8;
const DIAS_CALENDARIO = 10;

export interface FilaCalendario { lote: Lote; dias: DiaCondicion[]; esMinimo: boolean }

/**
 * "Cuándo entra cada lote": una fila por lote y una columna por día, de hoy a
 * los próximos días, con el color de la condición estimada de cada uno. Son los
 * mismos datos de la estimación, juntos en una sola grilla. Los días que salen
 * del pronóstico se ven más claros; sin estimación el lote no tiene fila.
 */
export function CalendarioCondicion({ filas, dia, onSelectLote }: { filas: FilaCalendario[]; dia: string; onSelectLote: (id: string) => void }) {
  const [todas, setTodas] = useState(false);
  const columnas = useMemo(
    () => [...new Set(filas.flatMap((fila) => fila.dias.map((condicion) => condicion.fecha)))].sort().slice(0, DIAS_CALENDARIO),
    [filas],
  );
  if (filas.length === 0 || columnas.length < 2) return null;
  const visibles = todas ? filas : filas.slice(0, FILAS_CALENDARIO);
  return (
    <section className="rounded-2xl border border-[var(--color-campo-100)] bg-white p-3.5" aria-label="Condición estimada de cada lote, día por día">
      <div className="mb-2.5 flex items-center gap-1.5">
        <h4 className="m-0 text-[0.68rem] font-bold tracking-[0.08em] text-gray-400 uppercase">Cuándo entra cada lote</h4>
        <AvisoInfo tono="info" titulo="Cómo leerlo">
          <p className="m-0 mb-1">Cada casillero es la condición estimada de ese lote ese día. Los días más claros usan el pronóstico del clima.</p>
          <p className="m-0">Es una estimación con el clima, la pastura y el último pastoreo. No es una medición.</p>
        </AvisoInfo>
      </div>
      <div className="grid items-center gap-x-[3px] gap-y-1" style={{ gridTemplateColumns: `3.6rem repeat(${columnas.length}, minmax(0, 1fr))` }}>
        <span />
        {columnas.map((fecha) => (
          <span key={fecha} className={`text-center text-[0.58rem] leading-none ${fecha === dia ? "font-bold text-gray-700" : "text-gray-400"}`}>
            {fecha === dia ? "hoy" : Number(fecha.slice(8, 10))}
          </span>
        ))}
        {visibles.map(({ lote, dias, esMinimo }) => (
          <Fragment key={lote.id}>
            <button type="button" onClick={() => onSelectLote(lote.id)} className="cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[0.74rem] font-semibold text-gray-800 hover:underline">
              Lote {lote.numero}
            </button>
            {columnas.map((fecha) => {
              const condicion = dias.find((item) => item.fecha === fecha);
              if (!condicion) return <span key={fecha} className="h-4 rounded-[3px] bg-gray-100" />;
              const { texto } = CONDICION_PASTOREO[condicion.condicion];
              const color = COLOR_CALENDARIO[condicion.condicion];
              const pronostico = condicion.climaUsado === "pronostico";
              return (
                <span
                  key={fecha}
                  className="h-4 rounded-[3px]"
                  style={{ background: color, opacity: pronostico ? 0.7 : 1 }}
                  title={`Lote ${lote.numero} · ${fechaCorta(fecha)} · ${esPiso(esMinimo, condicion.condicion) ? "como mínimo " : ""}${texto}${pronostico ? " · según pronóstico" : ""}`}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      {filas.length > FILAS_CALENDARIO && (
        <button type="button" onClick={() => setTodas((actual) => !actual)} className="mt-2.5 cursor-pointer border-0 bg-transparent p-0 text-[0.72rem] font-semibold text-[var(--color-campo-700)] hover:underline">
          {todas ? "Ver menos" : `Ver los ${filas.length} lotes`}
        </button>
      )}
    </section>
  );
}


/** Última respuesta por establecimiento y lotes: al volver a la solapa se ve al instante y se refresca por detrás. */
const ultimasEstimaciones = new Map<string, Map<string, EstimacionForraje>>();

/**
 * El calendario de la solapa Lotes. Pide la estimación de todos los lotes en una
 * sola llamada (el backend agrupa las consultas) y arma una fila por lote con
 * estimación. Va en el orden para pastorear de hoy; sin él, por número.
 */
export default function CalendarioLotes({ lotesActivos, orden, refresco, onSelectLote }: {
  lotesActivos: Lote[]; orden: EstadoOrdenPastoreo | undefined; refresco?: unknown; onSelectLote: (id: string) => void;
}) {
  const { establecimientoId } = useEstablecimiento();
  const claveLotes = `${establecimientoId}|${lotesActivos.map((lote) => `${lote.id}:${lote.tipoPastura ?? ""}`).join(",")}`;
  const [estimaciones, setEstimaciones] = useState<Map<string, EstimacionForraje>>(() => ultimasEstimaciones.get(claveLotes) ?? new Map());
  const [error, setError] = useState<string | null>(null);
  const dia = hoy();

  useEffect(() => {
    let vigente = true;
    setEstimaciones(ultimasEstimaciones.get(claveLotes) ?? new Map());
    setError(null);
    if (lotesActivos.length === 0) return;
    obtenerEstimacionesForraje(establecimientoId)
      .then((resultado) => {
        const porLote = new Map(resultado.map((item) => [item.loteId, item.estimacion] as const));
        ultimasEstimaciones.set(claveLotes, porLote);
        if (vigente) setEstimaciones(porLote);
      })
      .catch((motivo: unknown) => { if (vigente) setError(motivo instanceof ApiError ? motivo.message : "No se pudo calcular la estimación."); });
    return () => { vigente = false; };
    // lotesActivos queda fuera a propósito: claveLotes lo resume.
  }, [claveLotes, refresco]); // eslint-disable-line react-hooks/exhaustive-deps

  const posiciones = useMemo(
    () => new Map(orden?.estado === "ok" ? orden.orden.lotes.map((item) => [item.loteId, item.posicion] as const) : []),
    [orden],
  );

  const filas = useMemo(() => [...lotesActivos]
    .sort((a, b) => (posiciones.get(a.id) ?? Number.POSITIVE_INFINITY) - (posiciones.get(b.id) ?? Number.POSITIVE_INFINITY) || a.numero - b.numero)
    .flatMap((lote): FilaCalendario[] => {
      const reingreso = estimaciones.get(lote.id)?.reingreso;
      const dias = reingreso?.condiciones.filter((condicion) => condicion.fecha >= dia) ?? [];
      return reingreso && dias.length >= 2 ? [{ lote, dias, esMinimo: reingreso.esMinimo }] : [];
    }), [lotesActivos, estimaciones, posiciones, dia]);

  if (error && filas.length === 0) return <p className="m-0 text-[0.78rem] text-gray-500">No se pudo armar el calendario de los lotes: {error}</p>;
  return <CalendarioCondicion filas={filas} dia={dia} onSelectLote={onSelectLote} />;
}