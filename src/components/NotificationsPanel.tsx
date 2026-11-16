import type { Notificacion } from "../api/notificaciones";
import type { Lote } from "../types";
import Button from "./ui/Button";
import Panel from "./ui/Panel";
import { categoriaNotificacion, fechaAmigableNotificacion, fechaCompletaNotificacion } from "../utils/notification-presentation";
import vacaAsomada from "../assets/VacaAsomada.webp";
import campoGranja from "../assets/CampoGranja.webp";

/**
 * Recortes del Figma que acompañan la tarjeta. Son decorativos: ilustran la
 * categoría, no muestran ningún dato. Las categorías sin recorte (equipo,
 * seguridad) se quedan con el ícono.
 *
 * Cada foto lleva su propio encuadre: la vaca es casi cuadrada y asoma por el
 * borde de arriba, el campo es apaisado y se apoya abajo a la derecha. Con un
 * solo recorte para las dos, a la vaca le quedaba la cabeza cortada.
 */
/** Espejada: en el Figma la vaca se asoma mirando hacia adentro de la tarjeta. */
const VACA = "pointer-events-none absolute -top-[12%] right-1 h-[124%] w-20 scale-x-[-1] object-contain object-bottom";
const CAMPO = "pointer-events-none absolute right-0 bottom-0 h-[72%] w-20 object-contain object-right-bottom";

const RECORTES: Record<string, { src: string; clase: string }> = {
  "GPS simulado": { src: vacaAsomada, clase: VACA },
  Lotes: { src: campoGranja, clase: CAMPO },
  Satélite: { src: campoGranja, clase: CAMPO },
  Clima: { src: campoGranja, clase: CAMPO },
};

interface NotificationsPanelProps {
  lotes: Lote[];
  items: Notificacion[];
  noLeidas: number;
  offset: number;
  total: number;
  hayMas: boolean;
  limit: number;
  cargando: boolean;
  accionando: boolean;
  error: string | null;
  onRetry: () => void;
  onMarcarLeida: (id: string) => void;
  onEliminarLeida: (id: string) => void;
  onMarcarTodas: () => void;
  onAnterior: () => void;
  onSiguiente: () => void;
  /** Lleva al lote de la notificación en el mapa. Sin él no aparece el botón. */
  onVerLote?: (loteId: string) => void;
}

function referenciasLote(metadata: unknown): Array<{ numero: number; apodo?: string | null }> {
  if (!metadata || typeof metadata !== "object") return [];
  const root = metadata as Record<string, unknown>;
  const referencias: Array<{ numero: number; apodo?: string | null }> = [];
  const agregar = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const referencia = value as Record<string, unknown>;
    if (typeof referencia.numero === "number") referencias.push({ numero: referencia.numero, apodo: typeof referencia.apodo === "string" ? referencia.apodo : null });
  };
  // De dónde venía el ganado va primero: la tarjeta los muestra "anterior → actual".
  agregar(root.loteAnterior);
  agregar(root.referenciaLote);
  if (Array.isArray(root.eventos)) {
    for (const evento of root.eventos) {
      if (evento && typeof evento === "object") agregar((evento as Record<string, unknown>).detalles && ((evento as Record<string, unknown>).detalles as Record<string, unknown>).referenciaLote);
    }
  }
  return [...new Map(referencias.map((referencia) => [referencia.numero, referencia])).values()];
}

/** Hora corta para las de hoy, como el Figma; para las más viejas, la fecha. */
function momentoNotificacion(iso: string): string {
  const momento = new Date(iso);
  const esDeHoy = momento.toDateString() === new Date().toDateString();
  return esDeHoy
    ? momento.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
    : fechaAmigableNotificacion(iso);
}

/** Flecha verde del Figma, al principio de cada tarjeta. */
function Flecha() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="var(--color-campo-600)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

export default function NotificationsPanel(props: NotificationsPanelProps) {
  return <Panel plano aria-labelledby="notifications-title">
    <div className="flex items-start justify-between gap-2.5">
      {/* Con avisos sin leer el panel es la bandeja; sin ninguno, es el
          historial. El Figma usa un título distinto para cada caso. */}
      <div>
        <h3 id="notifications-title" className="m-0 text-xl font-medium tracking-[-0.02em] text-gray-900">
          {props.noLeidas > 0 ? "Notificaciones" : "Historial de notificaciones"}
        </h3>
        {props.noLeidas > 0 && <p className="m-0 text-sm text-gray-500">{props.noLeidas} sin leer</p>}
      </div>
      {props.noLeidas > 0 && <Button variant="link" onClick={props.onMarcarTodas} disabled={props.accionando}>Marcar todas como leídas</Button>}
    </div>

    {props.error && <div className="flex justify-between gap-2 rounded-md border border-red-300 bg-red-100 p-2.5 text-sm text-red-800" role="alert"><span>{props.error}</span><Button variant="link" onClick={props.onRetry}>Reintentar</Button></div>}
    {props.cargando && props.items.length === 0 && <p aria-live="polite">Cargando notificaciones...</p>}
    {!props.cargando && !props.error && props.items.length === 0 && <p className="px-2 py-4.5 text-center text-gray-500">No tenés notificaciones.</p>}

    {props.items.length > 0 && <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {props.items.map((item) => {
        const lote = item.loteId ? props.lotes.find((actual) => actual.id === item.loteId) : undefined;
        const referencias = referenciasLote(item.metadata);
        const categoria = categoriaNotificacion(item.tipo);
        // Las referencias de metadata vienen por número; el id para ir al mapa
        // sale del lote que coincida con ese número.
        const destino = lote ?? (referencias.length === 1 ? props.lotes.find((actual) => actual.numero === referencias[0].numero) : undefined);
        // Con lote anterior y actual se muestran los dos, aunque el aviso apunte sólo al actual.
        const conTraslado = referencias.length === 2 && /gps/.test(item.tipo);
        const etiquetasLote = lote && !conTraslado
          ? [`Lote ${lote.numero}${lote.apodo ? ` · ${lote.apodo}` : ""}`]
          : referencias.map((referencia) => `Lote ${referencia.numero}${referencia.apodo ? ` · ${referencia.apodo}` : ""}`);

        const recorte = RECORTES[categoria.etiqueta];
        // Los avisos del GPS simulado se borran aunque no estén leídos; el resto, una vez leído.
        const borrable = item.leida || item.tipo === "gps_simulado_en_lote" || item.tipo === "gps_simulado_cambio_lote";

        // El aviso de lote del GPS lleva la misma tarjeta que el aviso de arriba del mapa,
        // con "Marcar como leída" y "Ver en el campo" en lugar de "Ver ficha".
        if (item.tipo === "gps_simulado_en_lote" || item.tipo === "gps_simulado_cambio_lote") {
          const actual = referencias.at(-1);
          const anterior = referencias.length === 2 ? referencias[0] : undefined;
          return <li key={item.id}>
            <article className={`relative flex items-center gap-4 overflow-hidden rounded-[22px] border-2 bg-white py-4 pr-3 pl-4 text-gray-900 shadow-[0_6px_20px_rgba(0,0,0,0.12)] ${item.leida ? "border-gray-200" : "border-[var(--color-lima)]"}`}>
              {borrable && <button
                type="button"
                title="Borrar"
                aria-label={`Borrar notificación: ${item.titulo}`}
                onClick={() => props.onEliminarLeida(item.id)}
                disabled={props.accionando}
                className="foco-campo absolute top-1.5 left-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-red-600/80 transition-colors duration-150 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>}
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-none text-[var(--color-lima)]">
                <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex min-w-0 flex-1 flex-col gap-2 leading-tight">
                <span className="text-[1.2rem] font-medium tracking-[-0.02em]">
                  {anterior ? "Tu ganado se desplazó de lote" : "Tu ganado está en un lote"}
                </span>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.86rem] text-gray-700">
                  {anterior && <><span className="font-semibold">Lote {anterior.numero}</span><svg width="32" height="14" viewBox="0 0 26 12" fill="none" role="img" aria-label="hacia" className="flex-none text-[var(--color-lima)]"><path d="M1 6h22M18.5 1.5 23 6l-4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></>}
                  {actual && <span className="font-semibold">{actual.apodo ? `Lote ${actual.numero} — ${actual.apodo}` : `Lote ${actual.numero}`}</span>}
                  <time dateTime={item.createdAt} title={fechaCompletaNotificacion(item.createdAt)} className="tabular-nums">{momentoNotificacion(item.createdAt)}</time>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!item.leida && <button
                    type="button"
                    onClick={() => props.onMarcarLeida(item.id)}
                    disabled={props.accionando}
                    className="foco-campo cursor-pointer rounded-full border border-gray-300 bg-white px-3.5 py-1.5 text-[0.8rem] font-semibold text-gray-700 transition-colors hover:border-[var(--color-campo-600)] hover:text-[var(--color-campo-700)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Marcar como leída
                  </button>}
                  {destino && props.onVerLote && <button
                    type="button"
                    onClick={() => props.onVerLote?.(destino.id)}
                    className="foco-campo cursor-pointer rounded-full border-0 bg-[var(--color-lima)] px-3.5 py-1.5 text-[0.8rem] font-semibold text-gray-900 transition-colors hover:bg-[var(--color-verde-accion)]"
                  >
                    Ver en el campo
                  </button>}
                </div>
                <span className="text-[0.7rem] font-medium tracking-wide text-gray-500">
                  Simulación de GPS · no es un dato real
                </span>
              </div>
              <img src={vacaAsomada} alt="" aria-hidden="true" className="-my-4 -mr-1 h-[7.5rem] w-24 flex-none scale-x-[-1] self-end object-contain object-bottom" />
            </article>
          </li>;
        }

        return <li key={item.id}>
          <article
            className={`relative overflow-hidden rounded-2xl border p-3 ${item.leida ? "border-gray-200 bg-gray-50" : "border-[var(--color-lima)] bg-[var(--color-campo-50)]"}`}
          >
            {recorte && <img src={recorte.src} alt="" aria-hidden="true" className={recorte.clase} />}
            {borrable && <button
              type="button"
              aria-label={`Borrar notificación: ${item.titulo}`}
              title="Borrar"
              onClick={() => props.onEliminarLeida(item.id)}
              disabled={props.accionando}
              className="foco-campo absolute top-1.5 right-1.5 z-10 grid h-6 w-6 cursor-pointer place-items-center rounded-full border-0 bg-white/90 text-[0.95rem] leading-none text-gray-500 shadow-sm transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ×
            </button>}
            <div className={`relative flex items-start gap-2 ${recorte ? "pr-20" : borrable ? "pr-7" : ""}`}>
              <Flecha />
              <div className="min-w-0 flex-1">
                <strong className="block text-[0.9rem] leading-snug font-semibold text-gray-900">{item.titulo}</strong>
                <p className="m-0 mt-0.5 text-[0.82rem] leading-snug text-gray-600">{item.mensaje}</p>
              </div>
              {!recorte && <span className="shrink-0 text-[0.8rem]" aria-label={categoria.etiqueta} title={categoria.etiqueta}>{categoria.icono}</span>}
            </div>

            <div className={`relative mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.76rem] text-gray-500 ${recorte ? "pr-20" : ""}`}>
              {etiquetasLote.map((etiqueta, indice) => <span key={etiqueta}>
                {indice > 0 && <span aria-hidden="true" className="mr-3 text-gray-400">→</span>}
                {etiqueta}
              </span>)}
              <time dateTime={item.createdAt} title={fechaCompletaNotificacion(item.createdAt)}>{momentoNotificacion(item.createdAt)}</time>
              <span className="ml-auto flex items-center gap-2">
                {!item.leida && <Button variant="link" onClick={() => props.onMarcarLeida(item.id)} disabled={props.accionando}>Marcar como leída</Button>}
                {destino && props.onVerLote && <button
                  type="button"
                  className="foco-campo cursor-pointer rounded-full border-0 bg-[var(--color-verde-accion)] px-3 py-1 text-[0.76rem] font-medium text-gray-900 transition-colors duration-150 hover:bg-[var(--color-lima)]"
                  onClick={() => props.onVerLote?.(destino.id)}
                >
                  Ver en el campo
                </button>}
              </span>
            </div>
          </article>
        </li>;
      })}
    </ul>}

    {props.total > props.limit && <div className="flex items-center justify-center gap-2.5 text-xs text-gray-500">
      <Button variant="secondary" size="sm" onClick={props.onAnterior} disabled={props.offset === 0 || props.cargando}>Anterior</Button>
      <span>{props.offset + 1}–{Math.min(props.offset + props.items.length, props.total)} de {props.total}</span>
      <Button variant="secondary" size="sm" onClick={props.onSiguiente} disabled={!props.hayMas || props.cargando}>Siguiente</Button>
    </div>}
  </Panel>;
}
