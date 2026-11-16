import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { obtenerEstimacionesForraje, type CondicionPastoreo, type EstimacionForraje, type LoteOrdenado } from "../api/estimacion";
import { CONDICION_PASTOREO, ORDEN_CONDICION, resumirCondicion, type ResumenCondicion } from "../estimacion/presentacion";
import { useEstablecimiento } from "../hooks/useEstablecimiento";
import type { EstadoOrdenPastoreo } from "../hooks/useOrdenPastoreo";
import CompletarDatosLote, { type AccionesCompletarLote } from "./CompletarDatosLote";
import LoteExpandido from "./LoteExpandido";
import { NOMBRES_PASTURA, type Lote } from "../types";
import AvisoInfo from "./ui/AvisoInfo";
import Panel from "./ui/Panel";
import IconoFiltro from "./ui/IconoFiltro";
import { haceCuanto } from "../utils/notification-presentation";
import { MUTED, MUTED_SMALL } from "./ui/ranking";

interface CondicionPanelProps extends AccionesCompletarLote {
  lotesActivos: Lote[];
  analizando: boolean;
  ultimoAnalisis: number | null;
  errorGlobal: string | null;
  credencialesOk: boolean | null;
  selectedLoteId: string | null;
  /** El orden para pastorear hoy; lo pide la pantalla una vez para la sidebar y este panel. */
  orden: EstadoOrdenPastoreo;
  /** Cambia cuando se actualiza el clima, para volver a pedir las estimaciones. */
  refresco?: unknown;
  onAnalizar: () => void;
  onSelectLote: (id: string) => void;
}

type ClaveFiltro = CondicionPastoreo | "sin-estimacion";

const GRIS = "#9ca3af";

const OPCIONES_FILTRO: { clave: ClaveFiltro; etiqueta: string; color: string }[] = [
  ...ORDEN_CONDICION.map((clave) => ({ clave, etiqueta: CONDICION_PASTOREO[clave].texto, color: CONDICION_PASTOREO[clave].color })),
  { clave: "sin-estimacion", etiqueta: "Sin etiqueta", color: GRIS },
];

type EstadoEstimacion = { estado: "ok"; estimacion: EstimacionForraje } | { estado: "error"; mensaje: string };

/** Última respuesta por establecimiento y lotes: al volver al mapa se muestra al instante y se refresca por detrás. */
const ultimasEstimaciones = new Map<string, Record<string, EstadoEstimacion>>();

function nombreLote(lote: Lote): string {
  return lote.apodo ? `Lote ${lote.numero} — ${lote.apodo}` : `Lote ${lote.numero}`;
}

function hoy(): string {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
}

function resumenDe(lote: Lote, estado: EstadoEstimacion | undefined, dia: string): ResumenCondicion {
  if (estado?.estado === "error") return { condicion: null, prefijo: null, titulo: "Sin estimación", frase: estado.mensaje, nota: null, ayudaFecha: null };
  return resumirCondicion(lote, estado?.estimacion ?? null, dia);
}

const FILAS_POR_GRUPO = 8;
/**
 * La respuesta corta: cuántos lotes hay en cada condición hoy, en una barra y
 * con los conteos. La condición es la misma de la fila de abajo; el satélite no
 * interviene.
 */
function ResumenDelDia({ lotes, claveDe, leyenda }: { lotes: Lote[]; claveDe: (lote: Lote) => ClaveFiltro; leyenda: string }) {
  const filas = [...ORDEN_CONDICION, "sin-estimacion" as const]
    .map((clave) => [clave, lotes.filter((lote) => claveDe(lote) === clave).length] as const)
    .filter(([, cantidad]) => cantidad > 0);
  if (filas.length === 0) return null;
  const colorDe = (clave: ClaveFiltro) => (clave === "sin-estimacion" ? GRIS : CONDICION_PASTOREO[clave].color);
  return (
    <div className="rounded-2xl border-2 border-[var(--color-lima)] bg-white p-3.5">
      <div className="mb-2.5 flex items-center gap-1.5">
        <p className="m-0 text-[0.68rem] font-bold tracking-[0.08em] text-gray-400 uppercase">Hoy en el campo</p>
        <AvisoInfo tono="info" titulo="De dónde sale">
          <p className="m-0 mb-1">Estimación provisional con el clima, el tipo de pastura y el último pastoreo de cada lote. No es una medición.</p>
          <p className="m-0">No es lo mismo que el color del lote en el mapa: ese es el verdor que vio el satélite. Acá se calcula cuánto descansó el pasto, y el satélite no interviene.</p>
        </AvisoInfo>
      </div>
      <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={filas.map(([clave, cantidad]) => `${clave === "sin-estimacion" ? "Sin datos" : CONDICION_PASTOREO[clave].texto}: ${cantidad}`).join(", ")}>
        {filas.map(([clave, cantidad]) => <span key={clave} style={{ flex: cantidad, background: colorDe(clave) }} />)}
      </div>
      <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-x-3.5 gap-y-1 p-0">
        {filas.map(([clave, cantidad]) => (
          <li key={clave} className="flex items-center gap-1.5 text-[0.78rem] text-gray-700">
            <i aria-hidden="true" className="inline-block h-2 w-2 rounded-[2px]" style={{ background: colorDe(clave) }} />
            {clave === "sin-estimacion" ? "Sin datos" : CONDICION_PASTOREO[clave].corto}
            <b className="tabular-nums text-gray-900">{cantidad}</b>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-2.5 text-[0.68rem] font-semibold text-gray-500">{leyenda}</p>
    </div>
  );
}

/**
 * Un lote dentro de su grupo: nombre, condición y una flecha que despliega el
 * panel con la miniatura y la regeneración. Lo que falta cargar se ofrece
 * siempre a la vista, porque es lo único que pide acción.
 */
function FilaCondicion({ lote, estado, ordenado, dia, seleccionado, onSelect, acciones, establecimientoId }: {
  lote: Lote; estado: EstadoEstimacion | undefined; ordenado: LoteOrdenado | undefined; dia: string; seleccionado: boolean; onSelect: () => void; acciones: AccionesCompletarLote; establecimientoId: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const resumen = resumenDe(lote, estado, dia);
  const color = resumen.condicion ? CONDICION_PASTOREO[resumen.condicion].color : GRIS;
  return (
    <div className={`rounded-xl border bg-white p-2.5 transition-shadow ${seleccionado ? "border-[#79DA58] shadow-[0_0_0_1px_#79DA58]" : "border-gray-200"}`}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left">
          <span className="flex min-w-0 items-baseline gap-1.5 text-[0.9rem] tracking-[-0.02em] text-black">
            {ordenado && <span className="font-medium text-black/35 tabular-nums">{ordenado.posicion}.</span>}
            <span className="truncate font-semibold">{nombreLote(lote)}</span>
            {lote.tipoPastura && <span className="text-[0.72rem] font-normal text-gray-500">{NOMBRES_PASTURA[lote.tipoPastura]}</span>}
          </span>
          <span
            className="mt-1 inline-flex h-5 items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-2 text-[0.74rem] font-medium text-black"
            style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
          >
            {resumen.titulo}
          </span>
        </button>
        {resumen.nota && <AvisoInfo titulo="Sin pastoreos registrados">{resumen.nota}</AvisoInfo>}
        <Link
          to={`/establecimientos/${establecimientoId}/lotes/${lote.id}`}
          className="foco-campo flex h-7 flex-none items-center rounded-full border border-[#79DA58] bg-[rgba(151,234,124,0.6)] px-2.5 text-[0.74rem] font-medium text-black no-underline transition-colors duration-150 hover:bg-[rgba(151,234,124,0.9)]"
        >
          Ver ficha
        </Link>
        <button
          type="button"
          onClick={() => setAbierta((actual) => !actual)}
          aria-expanded={abierta}
          aria-label={abierta ? `Ocultar el detalle de ${nombreLote(lote)}` : `Ver el detalle de ${nombreLote(lote)}`}
          className="foco-campo grid size-7 flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`transition-transform duration-150 ${abierta ? "rotate-90" : ""}`}>
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {abierta && <LoteExpandido establecimientoId={establecimientoId} lote={lote} />}
      {ordenado && <DatosDelOrden lote={ordenado} />}
      {ordenado?.falta && <CompletarDatosLote loteId={lote.id} falta={ordenado.falta} {...acciones} />}
    </div>
  );
}

/** Un grupo de lotes con la misma condición: título con conteo, plegable, y de a pocos para no ser una lista interminable. */
function GrupoCondicion({ clave, lotes, abierto, renderFila }: { clave: ClaveFiltro; lotes: Lote[]; abierto: boolean; renderFila: (lote: Lote) => ReactNode }) {
  const [todos, setTodos] = useState(false);
  const { texto, color } = clave === "sin-estimacion"
    ? { texto: "Sin datos", color: GRIS }
    : { texto: CONDICION_PASTOREO[clave].texto, color: CONDICION_PASTOREO[clave].color };
  const visibles = todos ? lotes : lotes.slice(0, FILAS_POR_GRUPO);
  return (
    <details open={abierto} className="group rounded-2xl border border-[var(--color-campo-100)] bg-[var(--color-campo-50)]/60">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-none text-gray-400 transition-transform duration-150 group-open:rotate-90">
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <i aria-hidden="true" className="inline-block h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: color }} />
        <h4 className="m-0 text-[0.86rem] font-semibold tracking-[-0.01em] text-gray-900">{texto}</h4>
        <span className="text-[0.78rem] font-semibold text-gray-500 tabular-nums">{lotes.length}</span>
      </summary>
      <div className="flex flex-col gap-2 px-2.5 pb-2.5">
        {visibles.map((lote) => <div key={lote.id}>{renderFila(lote)}</div>)}
        {lotes.length > FILAS_POR_GRUPO && (
          <button type="button" onClick={() => setTodos((actual) => !actual)} className="cursor-pointer border-0 bg-transparent p-1 text-left text-[0.74rem] font-semibold text-[var(--color-campo-700)] hover:underline">
            {todos ? "Ver menos" : `Ver ${lotes.length - FILAS_POR_GRUPO} más`}
          </button>
        )}
      </div>
    </details>
  );
}


/** Lo que el orden suma a la card: el piso pesado y el pasto medido hoy. */
function DatosDelOrden({ lote }: { lote: LoteOrdenado }) {
  const piso = lote.grupo === "esperar-al-piso" ? lote.motivos[0] : null;
  const pasto = lote.pastoEnPieKgMsHa !== null ? lote.motivos.find((motivo) => motivo.includes("kg MS/ha"))?.split(";")[0].replace(/\.$/, "") ?? null : null;
  if (!piso && !pasto) return null;
  return (
    <div className="mt-2 flex flex-col gap-1 text-[0.75rem] leading-snug">
      {piso && <p className="m-0 rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-800">{piso}</p>}
      {pasto && <p className="m-0 text-gray-700">{pasto}, medido hoy.</p>}
    </div>
  );
}

/** Icono de refresco/consulta: reemplaza el texto plano del botón primario. */
function IconoActualizar({ girando }: { girando: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={girando ? "animate-spin" : ""}>
      <path
        d="M13.5 8A5.5 5.5 0 1 1 11.8 4M13.5 1.5V5H10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Condición estimada para pastorear de cada lote, a partir del estado foliar
 * (grados-día desde el último uso). Muestra lo que hace falta para decidir; los
 * números quedan en la ficha. Lee lo persistido: el botón sólo actualiza el
 * satélite, que llega al orden únicamente por las alertas de piso anegado.
 */
export default function CondicionPanel({
  lotesActivos,
  analizando,
  ultimoAnalisis,
  errorGlobal,
  credencialesOk,
  selectedLoteId,
  orden,
  refresco,
  onAnalizar,
  onSelectLote,
  onLoteActualizado,
  onPastoreoRegistrado,
  onActualizarClima,
  actualizandoClima,
}: CondicionPanelProps) {
  const acciones: AccionesCompletarLote = { onLoteActualizado, onPastoreoRegistrado, onActualizarClima, actualizandoClima };
  const { establecimientoId, puede } = useEstablecimiento();
  const [ocultas, setOcultas] = useState<Set<ClaveFiltro>>(new Set());
  const dia = hoy();
  // Pide de nuevo si cambian los lotes o su pastura, no cuando sólo cambia la identidad del array.
  const claveLotes = `${establecimientoId}|${lotesActivos.map((lote) => `${lote.id}:${lote.tipoPastura ?? ""}`).join(",")}`;
  const [estimaciones, setEstimaciones] = useState<Record<string, EstadoEstimacion>>(() => ultimasEstimaciones.get(claveLotes) ?? {});

  useEffect(() => {
    let vigente = true;
    const guardadas = ultimasEstimaciones.get(claveLotes);
    setEstimaciones(guardadas ?? {});
    if (lotesActivos.length === 0) return;
    // Una sola llamada para todo el establecimiento: el backend agrupa las consultas.
    obtenerEstimacionesForraje(establecimientoId)
      .then((resultado) => {
        if (!vigente) return;
        const porLote: Record<string, EstadoEstimacion> = {};
        for (const item of resultado) porLote[item.loteId] = { estado: "ok", estimacion: item.estimacion };
        ultimasEstimaciones.set(claveLotes, porLote);
        setEstimaciones(porLote);
      })
      .catch((reason) => {
        if (!vigente || guardadas) return;
        const mensaje = reason instanceof ApiError ? reason.message : "No se pudo calcular la estimación.";
        setEstimaciones(Object.fromEntries(lotesActivos.map((lote) => [lote.id, { estado: "error", mensaje } satisfies EstadoEstimacion])));
      });
    return () => { vigente = false; };
    // lotesActivos queda fuera a propósito: claveLotes lo resume.
  }, [establecimientoId, claveLotes, ultimoAnalisis, refresco]);

  const resumenes = useMemo(
    () => new Map(lotesActivos.map((lote) => [lote.id, resumenDe(lote, estimaciones[lote.id], dia)])),
    [lotesActivos, estimaciones, dia],
  );

  function claveDe(lote: Lote): ClaveFiltro {
    return resumenes.get(lote.id)?.condicion ?? "sin-estimacion";
  }

  const ordenados = useMemo(
    () => new Map(orden.estado === "ok" ? orden.orden.lotes.map((lote) => [lote.loteId, lote]) : []),
    [orden],
  );

  // El orden del backend manda. Mientras no llega, o si falla, de mejor a peor
  // condición y, dentro de cada una, más avance del estado foliar primero.
  const ranking = useMemo(() => [...lotesActivos].sort((a, b) => {
    const enOrden = (lote: Lote) => ordenados.get(lote.id)?.posicion ?? Number.POSITIVE_INFINITY;
    const posicion = (lote: Lote) => { const clave = claveDe(lote); return clave === "sin-estimacion" ? ORDEN_CONDICION.length : ORDEN_CONDICION.indexOf(clave); };
    const avance = (lote: Lote) => { const estado = estimaciones[lote.id]; return estado?.estado === "ok" ? estado.estimacion.reingreso?.condicionHoy?.avanceEstadoFoliar ?? 0 : 0; };
    return (enOrden(a) - enOrden(b) || 0) || posicion(a) - posicion(b) || avance(b) - avance(a) || a.numero - b.numero;
  }), [lotesActivos, estimaciones, resumenes, ordenados]);

  const cargando = lotesActivos.length > 0 && Object.keys(estimaciones).length === 0;

  // Los lotes de cada condición, en el orden de arriba; los grupos tildados en el filtro.
  const grupos = [...ORDEN_CONDICION, "sin-estimacion" as const]
    .map((clave) => [clave, ocultas.has(clave) ? [] : ranking.filter((lote) => claveDe(lote) === clave)] as const)
    .filter(([, lotesDelGrupo]) => lotesDelGrupo.length > 0);


  const avisoClass = "m-0 rounded-md border border-amber-300 bg-amber-100 p-2.5 text-[0.82rem] leading-normal text-amber-800 [&_code]:rounded [&_code]:bg-black/[0.07] [&_code]:px-1 [&_code]:text-[0.78rem]";

  function alternarFiltro(clave: ClaveFiltro) {
    setOcultas((actual) => {
      const siguiente = new Set(actual);
      siguiente.has(clave) ? siguiente.delete(clave) : siguiente.add(clave);
      return siguiente;
    });
  }

  return (
    <Panel plano>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="m-0 text-[29px] leading-[34px] font-normal tracking-[-0.03em] text-black">Condición para pastoreo</h3>
          <p className="m-0 font-[Helvetica,Arial,sans-serif] text-[15px] leading-5 tracking-[-0.06em] text-black">
            Ordenados según cuándo conviene entrar con los animales.
          </p>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <details className="group relative">
            <summary
              aria-label="Filtrar por condición"
              title="Filtrar"
              className="flex h-7 w-7 list-none items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 transition-colors marker:content-none hover:border-[var(--color-campo-600)] hover:text-[var(--color-campo-700)] [&::-webkit-details-marker]:hidden"
            >
              <IconoFiltro />
            </summary>
            <div className="absolute right-0 z-20 mt-1.5 flex w-48 flex-col gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
              {OPCIONES_FILTRO.map((op) => (
                <label key={op.clave} className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[0.78rem] text-gray-700 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={!ocultas.has(op.clave)}
                    onChange={() => alternarFiltro(op.clave)}
                  />
                  <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: op.color }} />
                  {op.etiqueta}
                </label>
              ))}
            </div>
          </details>

          <button
            type="button"
            onClick={onAnalizar}
            title="Consulta Sentinel-2 y recalcula las estimaciones"
            disabled={!puede("actualizar_satelite") || analizando || lotesActivos.length === 0}
            className="flex items-center gap-1.5 rounded-full border-0 bg-[var(--color-campo-700)] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:enabled:bg-[var(--color-campo-600)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconoActualizar girando={analizando} />
            {analizando ? "Consultando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {/* Configurar las credenciales es trabajo de quien administra RODEO. Al
          productor le sirve saber qué sigue andando y qué no. */}
      {credencialesOk === false && (
        <p className={avisoClass}>
          Las imágenes satelitales no están disponibles en esta instalación de RODEO.
          La condición para pastorear se calcula igual, con el clima y los pastoreos
          que cargues.
        </p>
      )}

      {lotesActivos.length === 0 && (
        <p className={MUTED}>
          No hay lotes activos. Activá al menos uno para estimar su condición.
        </p>
      )}

      {errorGlobal && <p className={avisoClass}>{errorGlobal}</p>}

      {ultimoAnalisis && !analizando && (
        <p className={MUTED_SMALL}>Satélite consultado {haceCuanto(ultimoAnalisis).toLowerCase()}.</p>
      )}

      {cargando && <p className={MUTED_SMALL}>Calculando la condición de los lotes…</p>}

      {orden.estado === "error" && <p className={MUTED_SMALL}>No se pudo armar el orden de los lotes: {orden.mensaje}</p>}
      {!cargando && orden.estado === "ok" && <ResumenDelDia lotes={ranking} claveDe={claveDe} leyenda={orden.orden.leyenda} />}


      {lotesActivos.length > 0 && !cargando && (
        <div className="flex flex-col gap-2.5">
          {grupos.map(([clave, lotesDelGrupo], indice) => (
            <GrupoCondicion
              key={clave}
              clave={clave}
              lotes={lotesDelGrupo}
              abierto={indice === 0}
              renderFila={(lote) => (
                <FilaCondicion lote={lote} estado={estimaciones[lote.id]} ordenado={ordenados.get(lote.id)} dia={dia} seleccionado={lote.id === selectedLoteId} onSelect={() => onSelectLote(lote.id)} acciones={acciones} establecimientoId={establecimientoId} />
              )}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}
