import { useEffect, useState } from "react";
import { useEstablecimiento } from "../hooks/useEstablecimiento";
import { useOcultarDock } from "../hooks/useOcultarDock";
import { Navigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { actualizarDispositivo, obtenerDispositivos, type Dispositivo } from "../api/dispositivos";
import PantallaDatos, { EstadoDePantalla, TARJETA, TITULO_SECCION, VOLANTA } from "../components/ui/PantallaDatos";
import { obtenerLotes } from "../api/rodeo";
import { avisarCambioNotificaciones } from "../hooks/useNotificaciones";
import type { Lote } from "../types";
import MapaCambioLote from "../components/mapa/MapaCambioLote";

function etiquetaIncidencia(tipo: string, condicion: Dispositivo["condicionBateria"]): string {
  if (tipo === "gps_simulado_bateria_episodio") return `Batería ${condicion ?? "baja"}`;
  const etiquetas: Record<string, string> = {
    gps_simulado_bateria_baja: "Batería baja",
    gps_simulado_bateria_critica: "Batería crítica",
    gps_simulado_bateria_agotada: "Batería agotada",
    gps_simulado_sin_senal: "Sin señal simulada",
    gps_simulado_fuera_establecimiento: "Fuera del establecimiento",
    gps_simulado_fuera_lote_asignado: "Fuera del lote asignado",
  };
  return etiquetas[tipo] ?? "Incidencia GPS simulada";
}

/** Campos del formulario con el verde de RODEO al enfocarlos. */
const CAMPO = "rounded-lg border border-[var(--color-campo-200)] bg-white px-3 py-2 outline-none transition-colors focus:border-[var(--color-campo-600)] focus:shadow-[0_0_0_3px_var(--color-campo-100)]";
/** Pastilla de estado: verde si está bien, ámbar o rojo si no. */
const ESTADO_OK = "bg-[var(--color-campo-100)] text-[var(--color-campo-700)]";
const ESTADO_AVISO = "bg-amber-100 text-amber-800";
const ESTADO_MAL = "bg-red-100 text-red-700";
const PASTILLA = "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold";

export default function PantallaDispositivosGps() {
  const { establecimientoId, establecimiento, membresia } = useEstablecimiento();
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]); const [seleccionado, setSeleccionado] = useState("");
  const [nombre, setNombre] = useState(""); const [bateria, setBateria] = useState("0"); const [conexion, setConexion] = useState<"en-linea" | "sin-senal">("en-linea");
  const [loteAsignadoId, setLoteAsignadoId] = useState(""); const [lotes, setLotes] = useState<Lote[]>([]);
  const [cargando, setCargando] = useState(true); const [guardando, setGuardando] = useState(false); const [error, setError] = useState(""); const [ok, setOk] = useState("");
  const visible = membresia?.rol === "PROPIETARIO" || membresia?.permisos.includes("ver_dispositivos_gps");
  const editable = membresia?.rol === "PROPIETARIO" || membresia?.permisos.includes("modificar_dispositivos_gps");
  async function cargar() { setCargando(true); setError(""); try { const [d, l] = await Promise.all([obtenerDispositivos(establecimientoId), obtenerLotes(establecimientoId)]); setDispositivos(d); setLotes(l.filter(x => x.activo)); setSeleccionado((s) => d.some((x) => x.id === s) ? s : d[0]?.id ?? ""); } catch (e) { setError(e instanceof ApiError ? e.message : "No se pudieron cargar los GPS simulados."); } finally { setCargando(false); } }
  useEffect(() => { void cargar(); }, [establecimientoId, membresia?.rol]);
  const actual = dispositivos.find((d) => d.id === seleccionado);
  useEffect(() => { if (actual) { setNombre(actual.apodo ?? ""); setBateria(String(actual.bateriaPorcentaje ?? 0)); setConexion(actual.conexion === "sin-senal" ? "sin-senal" : "en-linea"); setLoteAsignadoId(actual.loteAsignado?.id ?? ""); } }, [actual?.id, actual?.apodo, actual?.bateriaPorcentaje, actual?.conexion, actual?.loteAsignado?.id]);
  useOcultarDock(cargando);
  if (!visible) return <Navigate to={`/establecimientos/${establecimientoId}`} replace />;
  async function guardar() {
    if (!actual || !editable) return;
    const n = Number(bateria); if (!/^\d+$/.test(bateria) || !Number.isInteger(n) || n < 0 || n > 100) { setError("La batería debe ser un entero entre 0 y 100."); return; }
    setGuardando(true); setError(""); setOk("");
    try { const d = await actualizarDispositivo(establecimientoId, actual.id, { apodo: nombre, bateriaPorcentaje: n, conexion, loteAsignadoId: loteAsignadoId || null }); setDispositivos((xs) => xs.map((x) => x.id === d.id ? d : x)); setOk("Cambios guardados."); avisarCambioNotificaciones(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "No se pudieron guardar los cambios."); }
    finally { setGuardando(false); }
  }
  return <PantallaDatos volanta={establecimiento?.nombre ?? "Establecimiento"} titulo="Mis dispositivos" subtitulo="Dos GPS virtuales conectados al mapa. Sus ubicaciones, batería y configuración son simuladas y se guardan en tu cuenta.">
    {cargando ? <EstadoDePantalla>Cargando dispositivos…</EstadoDePantalla> : <div className="space-y-6">
      <p className={VOLANTA}>SIMULACIÓN · NO SON DATOS REALES DEL CAMPO</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}{ok && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{ok}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{dispositivos.map((d) => <div key={d.id} className={`${TARJETA} relative border-2 transition-colors ${seleccionado === d.id ? "border-[var(--color-lima)] bg-[var(--color-campo-50)]" : "border-transparent hover:bg-[var(--color-campo-50)]/60"}`}><button type="button" onClick={() => setSeleccionado(d.id)} className="block w-full cursor-pointer rounded-[inherit] p-4 text-left"><span className="text-[0.7rem] font-bold tracking-[0.08em] text-[var(--color-campo-700)] uppercase">GPS simulado {d.numero}</span><strong className="mt-1 block text-[1.05rem] text-gray-900">{d.apodo}</strong><span className="mt-2.5 flex flex-wrap gap-1.5"><span className={`${PASTILLA} ${d.condicionBateria === "critica" ? ESTADO_MAL : d.condicionBateria === "baja" ? ESTADO_AVISO : ESTADO_OK}`}>Batería {d.bateriaPorcentaje}% · {d.condicionBateria === "critica" ? "Crítica" : d.condicionBateria === "baja" ? "Baja" : "Normal"}</span><span className={`${PASTILLA} ${d.conexion === "en-linea" ? ESTADO_OK : ESTADO_MAL}`}>{d.conexion === "en-linea" ? "En línea" : "Sin señal"}</span></span>{(d.incidenciasActivas?.length ?? 0) > 0 && <span className="mt-1 block text-sm font-semibold text-red-700">Tiene {d.incidenciasActivas?.length} incidencia(s) activa(s)</span>}</button></div>)}</div>
      {actual && <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,42rem)_minmax(0,1fr)]"><section className={`${TARJETA} overflow-hidden border-t-4 border-[var(--color-lima)] p-6`}><h2 className={TITULO_SECCION}>GPS simulado {actual.numero}</h2><dl className="mt-4 grid grid-cols-2 gap-2.5 text-sm [&>div]:rounded-xl [&>div]:bg-[var(--color-campo-50)] [&>div]:px-3 [&>div]:py-2.5 [&_dt]:text-[0.68rem] [&_dt]:font-bold [&_dt]:tracking-[0.06em] [&_dt]:text-[var(--color-campo-700)] [&_dt]:uppercase [&_dd]:mt-0.5 [&_dd]:font-medium [&_dd]:text-gray-900"><div><dt>Ubicación actual</dt><dd>{actual.latitud?.toFixed(5)}, {actual.longitud?.toFixed(5)}</dd></div><div><dt>Establecimiento</dt><dd>{actual.dentroEstablecimiento ? "Dentro" : "Fuera"}</dd></div><div><dt>Lote actual detectado</dt><dd>{actual.loteActual ? `Lote ${actual.loteActual.numero}${actual.loteActual.apodo ? ` · ${actual.loteActual.apodo}` : ""}` : "Ninguno"}</dd></div><div><dt>Lote asignado</dt><dd>{actual.loteAsignado ? `Lote ${actual.loteAsignado.numero}${actual.loteAsignado.apodo ? ` · ${actual.loteAsignado.apodo}` : ""}` : "Sin lote asignado"}</dd></div><div><dt>Actualizado</dt><dd>{actual.actualizadaEn ? new Date(actual.actualizadaEn).toLocaleString("es-AR") : "Sin datos"}</dd></div><div><dt>Estado simulado</dt><dd>{actual.conexion === "en-linea" ? "En línea" : "Sin señal"}</dd></div></dl>
        {(actual.incidenciasActivas?.length ?? 0) > 0 && <div role="status" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>Incidencias activas</strong><ul className="mt-1 list-disc pl-5">{actual.incidenciasActivas?.map(tipo => <li key={tipo}>{etiquetaIncidencia(tipo, actual.condicionBateria)}</li>)}</ul></div>}
        {editable ? <div className="mt-5 grid gap-4"><label className="grid gap-1 text-sm">Apodo<input maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} /></label><label className="grid gap-1 text-sm">Batería simulada: {bateria}%<div className="flex gap-3"><input type="range" min="0" max="100" value={bateria || 0} onChange={(e) => setBateria(e.target.value)} className="flex-1 cursor-pointer accent-[var(--color-campo-700)]"/><input type="number" min="0" max="100" step="1" value={bateria} onChange={(e) => setBateria(e.target.value)} className={`${CAMPO} w-20 px-2 py-1`}/></div></label><label className="grid gap-1 text-sm">Conexión simulada<select value={conexion} onChange={(e) => setConexion(e.target.value as "en-linea" | "sin-senal")} className={CAMPO}><option value="en-linea">En línea</option><option value="sin-senal">Sin señal</option></select></label><label className="grid gap-1 text-sm">Lote asignado<select value={loteAsignadoId} onChange={e => setLoteAsignadoId(e.target.value)} className={CAMPO}><option value="">Sin lote asignado</option>{lotes.map(l => <option key={l.id} value={l.id}>Lote {l.numero}{l.apodo ? ` · ${l.apodo}` : ""}</option>)}</select></label><button type="button" onClick={guardar} disabled={guardando} className="foco-campo mt-1 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border-0 bg-[var(--color-verde-accion)] px-6 py-3 text-[0.9rem] font-semibold tracking-[-0.01em] text-gray-900 shadow-[0_3px_10px_rgba(14,21,17,0.12)] transition-all duration-150 hover:-translate-y-px hover:bg-[var(--color-lima)] hover:shadow-[0_5px_14px_rgba(14,21,17,0.18)] active:translate-y-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:justify-self-start">{guardando ? "Guardando…" : "Guardar cambios"}</button></div> : <p className="mt-5 text-sm text-gray-600">Tenés permiso de lectura. Para editar este GPS, el propietario debe habilitar «Modificar dispositivos GPS» en Equipo.</p>}
      </section><MapaCambioLote establecimiento={establecimiento?.polygon} lotes={lotes} dispositivo={actual} /></div>}
    </div>}
  </PantallaDatos>;
}
