import { useEffect, useId, useRef, useState } from "react";
import Modal from "./ui/Modal";

interface PromptModalProps {
  title: string;
  label: string;
  /** Rótulo chico sobre el título (ej. "Establecimiento"). */
  volanta?: string;
  /** Bajada opcional bajo el título. */
  descripcion?: string;
  initialValue?: string;
  confirmText?: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

const TARJETA =
  "flex w-[min(92vw,26rem)] flex-col gap-4 rounded-[24px] bg-white p-6 shadow-[0_12px_36px_rgba(0,0,0,0.25)]";
const VOLANTA = "m-0 text-[0.68rem] font-bold tracking-[0.08em] text-[var(--color-campo-700)] uppercase";
const CAMPO =
  "w-full rounded-xl border border-gray-200 bg-[var(--color-campo-50)]/50 px-3.5 py-2.5 text-[0.95rem] text-gray-900 outline-none transition-colors duration-150 placeholder:text-gray-400 hover:border-[var(--color-campo-600)]/50 focus:border-[var(--color-campo-600)] focus:bg-white focus:shadow-[0_0_0_3px_var(--color-campo-100)]";
const GUARDAR =
  "foco-campo inline-flex cursor-pointer items-center rounded-full border-0 bg-[var(--color-verde-accion)] px-5 py-2 text-[0.85rem] font-semibold text-gray-900 transition-colors duration-150 hover:bg-[var(--color-lima)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--color-verde-accion)]";
const CANCELAR =
  "foco-campo cursor-pointer rounded-full border-0 bg-transparent px-3.5 py-2 text-[0.85rem] text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-800";

export default function PromptModal({
  title,
  label,
  volanta,
  descripcion,
  initialValue = "",
  confirmText = "Guardar",
  placeholder,
  onConfirm,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const idTitulo = useId();
  const idCampo = useId();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  return (
    <Modal onDismiss={onCancel}>
      <form
        className={TARJETA}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div>
          {volanta && <p className={VOLANTA}>{volanta}</p>}
          <h2 id={idTitulo} className="m-0 mt-0.5 text-[1.3rem] font-semibold text-gray-900">
            {title}
          </h2>
          {descripcion && <p className="m-0 mt-1 text-[0.85rem] text-gray-500">{descripcion}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-semibold text-gray-800" htmlFor={idCampo}>
            {label}
          </label>
          <input
            id={idCampo}
            ref={inputRef}
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            className={CAMPO}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className={CANCELAR} onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className={GUARDAR} disabled={!value.trim()}>
            {confirmText}
          </button>
        </div>
      </form>
    </Modal>
  );
}
