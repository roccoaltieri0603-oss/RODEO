import { useState } from "react";
import { ApiError } from "../api/client";
import { asignarPasturaLotes } from "../api/rodeo";
import { useEstablecimiento } from "../hooks/useEstablecimiento";
import { NOMBRES_PASTURA, type Lote, type TipoPastura } from "../types";
import BotonAccion from "./ui/BotonAccion";

interface PasturasOnboardingProps {
  lotes: Lote[];
  onLoteActualizado: (lote: Lote) => void;
  onTerminar: () => void;
}

const PILDORA_BASE =
  "texto-foto foco-campo cursor-pointer rounded-full border-2 px-3.5 py-1.5 text-[clamp(0.78rem,1.4vw,0.95rem)] font-medium text-white transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";
const SECUNDARIO =
  "texto-foto foco-campo w-full cursor-pointer rounded-[clamp(18px,3.1vw,40px)] border-4 border-white/50 bg-white/10 p-[clamp(0.45rem,0.7vw,0.55rem)] text-center text-[clamp(0.85rem,1.7vw,1.3rem)] font-medium tracking-[-0.03em] text-white transition-colors enabled:hover:border-[var(--color-verde-accion)] enabled:hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50";

function nombreLote(lote: Lote): string {
  return lote.apodo ? `Lote ${lote.numero} · ${lote.apodo}` : `Lote ${lote.numero}`;
}

/**
 * Último paso del onboarding: elegir la pastura y ponérsela a algunos lotes o a
 * todos. Es opcional; la pastura se puede cargar después desde la ficha de lote.
 * Guarda con el mismo endpoint de siempre (todos o ninguno).
 */
export default function PasturasOnboarding({ lotes, onLoteActualizado, onTerminar }: PasturasOnboardingProps) {
  const { establecimientoId } = useEstablecimiento();
  const activos = lotes.filter((lote) => lote.activo).sort((a, b) => a.numero - b.numero);
  const [tipo, setTipo] = useState<TipoPastura | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [tildados, setTildados] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  async function asignar(destino: Lote[]) {
    if (!tipo || destino.length === 0 || guardando) return;
    setGuardando(true); setMensaje(null);
    try {
      const actualizados = await asignarPasturaLotes(establecimientoId, destino.map((lote) => lote.id), tipo);
      actualizados.forEach(onLoteActualizado);
      setMensaje({ tono: "ok", texto: `${NOMBRES_PASTURA[tipo]} asignada a ${actualizados.length === 1 ? "1 lote" : `${actualizados.length} lotes`}.` });
      setEligiendo(false); setTildados([]);
    } catch (motivo) {
      setMensaje({ tono: "error", texto: motivo instanceof ApiError ? motivo.message : "No se pudo guardar la pastura. Intentá nuevamente." });
    } finally {
      setGuardando(false);
    }
  }

  const tildadosLotes = activos.filter((lote) => tildados.includes(lote.id));
  const sinPastura = activos.filter((lote) => lote.tipoPastura === null).length;

  return (
    <>
      <p className="texto-foto p-[clamp(0.4rem,0.78vw,0.625rem)] text-[clamp(0.9rem,2.03vw,1.62rem)] font-medium tracking-[-0.05em] text-white">
        Elegí la pastura de tus lotes. Podés asignarla a algunos o a todos de una vez.
      </p>

      <div role="radiogroup" aria-label="Tipo de pastura" className="flex flex-wrap gap-2 px-[clamp(0.4rem,0.78vw,0.625rem)]">
        {(Object.keys(NOMBRES_PASTURA) as TipoPastura[]).map((clave) => {
          const elegida = tipo === clave;
          return (
            <button
              key={clave}
              type="button"
              role="radio"
              aria-checked={elegida}
              disabled={guardando}
              onClick={() => { setTipo(clave); setMensaje(null); }}
              className={`${PILDORA_BASE} ${elegida ? "border-[var(--color-verde-accion)] bg-[color-mix(in_srgb,var(--color-verde-accion)_60%,transparent)]" : "border-white/40 bg-white/10 hover:border-white/80 hover:bg-white/20"}`}
            >
              {NOMBRES_PASTURA[clave]}
            </button>
          );
        })}
      </div>

      {!eligiendo ? (
        <div className="flex flex-col gap-2">
          <button type="button" className={SECUNDARIO} disabled={!tipo || guardando || activos.length === 0} onClick={() => { setEligiendo(true); setMensaje(null); }}>
            Asignar a…
          </button>
          <button type="button" className={SECUNDARIO} disabled={!tipo || guardando || activos.length === 0} onClick={() => void asignar(activos)}>
            {guardando ? "Guardando…" : "Asignar a todos"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-[clamp(16px,2.4vw,28px)] bg-black/25 p-3">
          <p className="texto-foto m-0 text-[clamp(0.8rem,1.5vw,1rem)] text-white">Tildá los lotes que llevan {tipo ? NOMBRES_PASTURA[tipo] : "esta pastura"}:</p>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {activos.map((lote) => {
              const tildado = tildados.includes(lote.id);
              return (
                <li key={lote.id}>
                  <label className={`texto-foto flex cursor-pointer items-center rounded-full border-2 px-3 py-1 text-[clamp(0.75rem,1.3vw,0.9rem)] text-white transition-colors duration-150 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--color-lima)] ${tildado ? "border-[var(--color-verde-accion)] bg-[color-mix(in_srgb,var(--color-verde-accion)_60%,transparent)]" : "border-white/40 bg-white/10 hover:border-white/80 hover:bg-white/20"}`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={tildado}
                      disabled={guardando}
                      onChange={() => setTildados((actuales) => (tildado ? actuales.filter((id) => id !== lote.id) : [...actuales, lote.id]))}
                    />
                    {nombreLote(lote)}
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <button type="button" className={`${SECUNDARIO} flex-1`} disabled={guardando} onClick={() => { setEligiendo(false); setTildados([]); }}>
              Cancelar
            </button>
            <button type="button" className={`${SECUNDARIO} flex-[2] !border-[var(--color-verde-accion)] !bg-[color-mix(in_srgb,var(--color-verde-accion)_60%,transparent)]`} disabled={guardando || tildadosLotes.length === 0} onClick={() => void asignar(tildadosLotes)}>
              {guardando ? "Guardando…" : tildadosLotes.length === 1 ? "Asignar a 1 lote" : `Asignar a ${tildadosLotes.length} lotes`}
            </button>
          </div>
        </div>
      )}

      {mensaje && (
        <p role={mensaje.tono === "error" ? "alert" : "status"} className={`texto-foto m-0 rounded-xl border border-white/40 p-2 text-[0.8rem] text-white ${mensaje.tono === "error" ? "bg-red-900/40" : "bg-black/25"}`}>
          {mensaje.texto}
        </p>
      )}

      <BotonAccion onClick={onTerminar} disabled={guardando}>
        {sinPastura > 0 ? "Terminar por ahora" : "Terminar"}
      </BotonAccion>
    </>
  );
}
