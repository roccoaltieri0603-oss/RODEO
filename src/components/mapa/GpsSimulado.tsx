import { useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import * as turf from "@turf/turf";
import { actualizarDispositivo, obtenerDispositivos, type Dispositivo } from "../../api/dispositivos";
import { useEstablecimiento } from "../../hooks/useEstablecimiento";
import ConfirmModal from "../ConfirmModal";
import { avisarCambioNotificaciones } from "../../hooks/useNotificaciones";
import type { Lote } from "../../types";
const TIEMPO_DENTRO_MS = 3000;
interface Props { lotesActivos: Lote[]; onLoteConfirmado: (lote: Lote | null) => void }
export default function GpsSimulado({ lotesActivos, onLoteConfirmado }: Props) {
  const map = useMap(); const { establecimientoId, establecimiento, membresia } = useEstablecimiento();
  const [items, setItems] = useState<Dispositivo[]>([]); const [error, setError] = useState("");
  /** Confirmación de sacar un GPS del establecimiento, esperando respuesta del usuario. */
  const [confirmacion, setConfirmacion] = useState<{ numero: number | undefined; resolver: (ok: boolean) => void } | null>(null);
  const itemsRef = useRef(items); itemsRef.current = items;
  const lotesRef = useRef(lotesActivos); lotesRef.current = lotesActivos;
  const loteCallbackRef = useRef(onLoteConfirmado); loteCallbackRef.current = onLoteConfirmado;
  // El establecimiento se vuelve a pedir cada 30 s y al volver a la pestaña: llega
  // como objeto nuevo aunque no cambie. Se lee por ref para no desarmar los puntos.
  const poligonoRef = useRef(establecimiento?.polygon); poligonoRef.current = establecimiento?.polygon;
  // El lote detectado sobrevive a que se vuelvan a dibujar los puntos: si sigue
  // en el mismo lote, el aviso no se apaga ni vuelve a esperar los 3 segundos.
  const loteActualIdRef = useRef<string | null>(null);
  useEffect(() => () => { loteCallbackRef.current(null); }, []);
  const puedeVer = membresia?.rol === "PROPIETARIO" || membresia?.permisos.includes("ver_dispositivos_gps");
  const puedeEditar = membresia?.rol === "PROPIETARIO" || membresia?.permisos.includes("modificar_dispositivos_gps");
  useEffect(() => {
    let vigente = true; let markers: L.Marker[] = []; let timeoutId: number | null = null;
    const evaluarLote = (latlng: L.LatLng) => {
      const lote = lotesRef.current.find((item) => turf.booleanPointInPolygon(turf.point([latlng.lng, latlng.lat]), item.polygon)) ?? null;
      if ((lote?.id ?? null) === loteActualIdRef.current) return;
      loteActualIdRef.current = lote?.id ?? null;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = null;
      loteCallbackRef.current(null);
      if (lote) timeoutId = window.setTimeout(() => loteCallbackRef.current(lote), TIEMPO_DENTRO_MS);
    };
    if (!puedeVer) return () => { map.dragging.enable(); };
    obtenerDispositivos(establecimientoId).then((todos) => {
    if (!vigente) return;
    const devices = todos;
    setItems(devices);
    markers = devices.map((d) => {
      if (d.latitud === undefined || d.longitud === undefined || d.numero === undefined) throw new Error("GPS simulado incompleto");
      const tieneProblema = d.dentroEstablecimiento === false || (d.incidenciasActivas?.length ?? 0) > 0 || d.condicionBateria === "baja" || d.condicionBateria === "critica" || d.conexion === "sin-senal";
      const icon = L.divIcon({ className: "gps-simulado-icon", html: `<div class="gps-simulado-punto${tieneProblema ? " gps-simulado-problema" : ""}"><span class="gps-simulado-radar"></span><span class="gps-simulado-nucleo"></span><b class="gps-simulado-numero">${d.numero}</b></div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
      return L.marker([d.latitud, d.longitud], { icon, draggable: puedeEditar, zIndexOffset: 1000 + d.numero }).addTo(map);
    });
    markers.forEach((marker, index) => {
      marker.on("dragstart", () => map.dragging.disable());
      if (devices[index]?.numero === 1) marker.on("drag", (event) => evaluarLote((event.target as L.Marker).getLatLng()));
      marker.on("dragend", async () => {
      map.dragging.enable();
      const device = itemsRef.current[index];
      const p = marker.getLatLng();
        if (device.numero === 1) evaluarLote(p);
      const polygon = poligonoRef.current;
      const afuera = polygon && !turf.booleanPointInPolygon(turf.point([p.lng, p.lat]), polygon);
      // Un window.confirm nativo rompía con el resto del diseño. El modal propio
      // se resuelve con una promesa para poder esperarlo acá adentro, que es un
      // callback de Leaflet y no un render de React.
      if (afuera && !await new Promise<boolean>((resolver) => setConfirmacion({ numero: device.numero, resolver }))) {
        if (device.latitud !== undefined && device.longitud !== undefined) marker.setLatLng([device.latitud, device.longitud]);
        if (device.numero === 1) evaluarLote(marker.getLatLng());
        return;
      }
      try { const updated = await actualizarDispositivo(establecimientoId, device.id, { latitud: p.lat, longitud: p.lng }); setItems((prev) => prev.map((x) => x.id === updated.id ? updated : x)); marker.setIcon(L.divIcon({ className: "gps-simulado-icon", html: `<div class="gps-simulado-punto${updated.dentroEstablecimiento === false || (updated.incidenciasActivas?.length ?? 0) > 0 || updated.condicionBateria === "baja" || updated.condicionBateria === "critica" || updated.conexion === "sin-senal" ? " gps-simulado-problema" : ""}"><span class="gps-simulado-radar"></span><span class="gps-simulado-nucleo"></span><b class="gps-simulado-numero">${updated.numero}</b></div>`, iconSize: [30,30], iconAnchor: [15,15] })); setError(""); avisarCambioNotificaciones(); }
      catch { setError(`No se pudo guardar la ubicación del GPS ${device.numero}.`); if (device.latitud !== undefined && device.longitud !== undefined) { marker.setLatLng([device.latitud, device.longitud]); if (device.numero === 1) evaluarLote(marker.getLatLng()); } }
      });
    });
    const primero = devices.find((device) => device.numero === 1);
    if (primero) evaluarLote(L.latLng(primero.latitud!, primero.longitud!));
    }).catch(() => { if (vigente) setError("No se pudieron cargar los GPS simulados."); });
    // Si quedó una espera de 3 s a medias, se olvida el lote para que la próxima vuelta la empiece de nuevo.
    return () => { vigente = false; if (timeoutId !== null) { window.clearTimeout(timeoutId); loteActualIdRef.current = null; } map.dragging.enable(); markers.forEach((m) => m.remove()); };
  }, [map, establecimientoId, puedeEditar, puedeVer]);
  function responder(ok: boolean) {
    confirmacion?.resolver(ok);
    setConfirmacion(null);
  }

  return <>
    {confirmacion && <ConfirmModal
      title="El GPS queda fuera del campo"
      message={`${confirmacion.numero === undefined ? "El GPS simulado" : `El GPS simulado ${confirmacion.numero}`} va a quedar fuera de los límites de tu establecimiento. ¿Guardás esa posición igual?`}
      confirmText="Guardar igual"
      confirmVariant="primary"
      onConfirm={() => responder(true)}
      onCancel={() => responder(false)}
    />}
    {error && <div className="pointer-events-none absolute bottom-4 left-1/2 z-[1000] -translate-x-1/2 rounded-md border border-red-400/50 bg-slate-900/90 px-3 py-1.5 text-xs text-red-100">{error}</div>}
  </>;
}
