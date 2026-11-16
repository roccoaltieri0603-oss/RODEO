import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Selector de fecha con el look de RODEO. Reemplaza al <input type="date">
 * nativo, cuyo calendario desplegable lo dibuja el navegador y no se puede
 * estilar con CSS. Trabaja con "YYYY-MM-DD" (o "" sin fecha), igual que el nativo.
 */
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const ANCHO_CALENDARIO = 288;
const ALTO_CALENDARIO = 340;

const dos = (numero: number) => String(numero).padStart(2, "0");
const aTexto = (anio: number, mes: number, dia: number) => `${anio}-${dos(mes + 1)}-${dos(dia)}`;

function leer(valor: string): { anio: number; mes: number; dia: number } | null {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!coincidencia) return null;
  return { anio: Number(coincidencia[1]), mes: Number(coincidencia[2]) - 1, dia: Number(coincidencia[3]) };
}

function hoyTexto(): string {
  const ahora = new Date();
  return aTexto(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
}

interface CampoFechaProps {
  value: string;
  onChange: (valor: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  "aria-label"?: string;
}

export default function CampoFecha({ value, onChange, min, max, disabled, autoFocus, className = "", "aria-label": etiqueta }: CampoFechaProps) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState(() => {
    const actual = leer(value) ?? leer(hoyTexto())!;
    return { anio: actual.anio, mes: actual.mes };
  });
  const [posicion, setPosicion] = useState({ izquierda: 0, arriba: 0 });
  const botonRef = useRef<HTMLButtonElement>(null);
  const calendarioRef = useRef<HTMLDivElement>(null);
  const idCalendario = useId();

  const abrir = () => {
    const actual = leer(value) ?? leer(hoyTexto())!;
    setVista({ anio: actual.anio, mes: actual.mes });
    setAbierto(true);
  };

  const ubicar = useCallback(() => {
    const boton = botonRef.current;
    if (!boton) return;
    const caja = boton.getBoundingClientRect();
    const izquierda = Math.max(8, Math.min(caja.left, window.innerWidth - ANCHO_CALENDARIO - 8));
    const cabeAbajo = caja.bottom + 6 + ALTO_CALENDARIO <= window.innerHeight;
    const arriba = cabeAbajo ? caja.bottom + 6 : Math.max(8, caja.top - 6 - ALTO_CALENDARIO);
    setPosicion({ izquierda, arriba });
  }, []);

  useLayoutEffect(() => {
    if (abierto) ubicar();
  }, [abierto, ubicar]);

  useEffect(() => {
    if (!abierto) return;
    const alMoverseFuera = (evento: MouseEvent) => {
      const objetivo = evento.target as Node;
      if (calendarioRef.current?.contains(objetivo) || botonRef.current?.contains(objetivo)) return;
      setAbierto(false);
    };
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.stopPropagation();
        setAbierto(false);
        botonRef.current?.focus();
      }
    };
    const alDesplazar = (evento: Event) => {
      if (calendarioRef.current?.contains(evento.target as Node)) return;
      ubicar();
    };
    document.addEventListener("mousedown", alMoverseFuera);
    document.addEventListener("keydown", alTeclear, true);
    window.addEventListener("resize", ubicar);
    window.addEventListener("scroll", alDesplazar, true);
    return () => {
      document.removeEventListener("mousedown", alMoverseFuera);
      document.removeEventListener("keydown", alTeclear, true);
      window.removeEventListener("resize", ubicar);
      window.removeEventListener("scroll", alDesplazar, true);
    };
  }, [abierto, ubicar]);

  const elegida = leer(value);
  const hoy = hoyTexto();
  const fueraDeRango = (texto: string) => (min ? texto < min : false) || (max ? texto > max : false);

  const primerDiaSemana = (new Date(vista.anio, vista.mes, 1).getDay() + 6) % 7; // lunes = 0
  const diasDelMes = new Date(vista.anio, vista.mes + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array.from({ length: primerDiaSemana }, () => null),
    ...Array.from({ length: diasDelMes }, (_, indice) => indice + 1),
  ];

  const moverMes = (delta: number) => {
    setVista((anterior) => {
      const fecha = new Date(anterior.anio, anterior.mes + delta, 1);
      return { anio: fecha.getFullYear(), mes: fecha.getMonth() };
    });
  };

  const elegir = (texto: string) => {
    onChange(texto);
    setAbierto(false);
    botonRef.current?.focus();
  };

  const textoVisible = elegida ? `${dos(elegida.dia)}/${dos(elegida.mes + 1)}/${elegida.anio}` : "dd/mm/aaaa";
  const botonNav = "grid size-8 place-items-center rounded-full text-[var(--color-campo-700)] transition-colors hover:bg-[var(--color-campo-100)] focus-visible:outline-2 focus-visible:outline-[var(--color-campo-600)]";

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={etiqueta}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls={abierto ? idCalendario : undefined}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        className={`${className} flex cursor-pointer items-center justify-between gap-2 text-left transition-colors hover:border-[var(--color-campo-600)] disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className={elegida ? "" : "text-gray-400"}>{textoVisible}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0 text-[var(--color-campo-700)]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
          <path d="M3 8.5h14M7 2.75v3.5M13 2.75v3.5" />
        </svg>
      </button>

      {abierto && createPortal(
        <div
          ref={calendarioRef}
          id={idCalendario}
          role="dialog"
          aria-label="Elegir fecha"
          style={{ left: posicion.izquierda, top: posicion.arriba, width: ANCHO_CALENDARIO }}
          className="fixed z-[3000] rounded-2xl border border-[var(--color-campo-100)] bg-white p-3 shadow-[0_12px_32px_rgba(14,21,17,0.28)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className={botonNav} onClick={() => moverMes(-1)} aria-label="Mes anterior">
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4.5 6.5 10l5.5 5.5" /></svg>
            </button>
            <p className="text-sm font-semibold text-[var(--color-campo-900)]" aria-live="polite">{MESES[vista.mes]} {vista.anio}</p>
            <button type="button" className={botonNav} onClick={() => moverMes(1)} aria-label="Mes siguiente">
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4.5 13.5 10 8 15.5" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-0.5 text-center">
            {DIAS.map((dia) => <span key={dia} className="py-1 text-[0.7rem] font-semibold text-gray-400">{dia}</span>)}
            {celdas.map((dia, indice) => {
              if (dia === null) return <span key={`vacio-${indice}`} />;
              const texto = aTexto(vista.anio, vista.mes, dia);
              const esElegida = texto === value;
              const esHoy = texto === hoy;
              const bloqueada = fueraDeRango(texto);
              return (
                <button
                  key={texto}
                  type="button"
                  disabled={bloqueada}
                  aria-pressed={esElegida}
                  aria-current={esHoy ? "date" : undefined}
                  onClick={() => elegir(texto)}
                  className={[
                    "mx-auto grid size-9 place-items-center rounded-full text-sm transition-colors",
                    esElegida
                      ? "bg-[var(--color-campo-900)] font-semibold text-[var(--color-lima)]"
                      : bloqueada
                        ? "cursor-not-allowed text-gray-300"
                        : "text-gray-800 hover:bg-[var(--color-campo-100)]",
                    esHoy && !esElegida ? "ring-1 ring-inset ring-[var(--color-campo-600)]" : "",
                  ].join(" ")}
                >
                  {dia}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-[0.8rem] font-medium">
            <button type="button" disabled={!value} onClick={() => elegir("")} className="rounded-full px-3 py-1 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent">
              Borrar
            </button>
            <button type="button" disabled={fueraDeRango(hoy)} onClick={() => elegir(hoy)} className="rounded-full px-3 py-1 text-[var(--color-campo-700)] transition-colors hover:bg-[var(--color-campo-100)] disabled:opacity-40 disabled:hover:bg-transparent">
              Hoy
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
