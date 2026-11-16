import { useEffect, useMemo } from "react";
import L from "leaflet";
import * as turf from "@turf/turf";
import { AttributionControl, CircleMarker, GeoJSON, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Dispositivo } from "../../api/dispositivos";
import type { Lote, PolygonFeature } from "../../types";
import AvisoInfo from "../ui/AvisoInfo";

/**
 * El último cambio de lote de un GPS simulado, sobre la foto del establecimiento:
 * un punto en el lote de donde salió, una línea punteada hasta donde está ahora
 * y los dos lotes resaltados.
 *
 * No es un recorrido: de cada GPS se guarda sólo la última posición. El punto
 * del lote anterior marca el lote, no dónde estaba el animal, y la línea sólo
 * une los dos lotes. Se dice siempre debajo del mapa.
 */
const AMBAR = "#f59e0b";
const LIMA = "#79da58";
const ROJO = "#ef4444";

function nombreLote(lote: Lote): string {
  return lote.apodo ? `Lote ${lote.numero} · ${lote.apodo}` : `Lote ${lote.numero}`;
}

function puntoDentro(lote: Lote): [number, number] {
  const [lng, lat] = turf.pointOnFeature(lote.polygon).geometry.coordinates;
  return [lat, lng];
}

/** Si el mapa nace en un contenedor sin tamaño, se vuelve a medir y encuadrar al aparecer. */
function Reencuadrar({ limites }: { limites: L.LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    const contenedor = map.getContainer();
    const observador = new ResizeObserver(() => {
      if (contenedor.clientWidth === 0 || contenedor.clientHeight === 0) return;
      map.invalidateSize();
      map.fitBounds(limites, { padding: [18, 18] });
    });
    observador.observe(contenedor);
    return () => observador.disconnect();
  }, [map, limites]);
  return null;
}

export default function MapaCambioLote({ establecimiento, lotes, dispositivo }: {
  establecimiento: PolygonFeature | null | undefined;
  lotes: Lote[];
  dispositivo: Dispositivo;
}) {
  const cambio = dispositivo.ultimoCambioLote ?? null;
  const anterior = cambio?.loteAnteriorId ? lotes.find((lote) => lote.id === cambio.loteAnteriorId) : undefined;
  const destino = cambio ? lotes.find((lote) => lote.id === cambio.loteActualId) : undefined;
  const posicion: [number, number] | null = dispositivo.latitud !== undefined && dispositivo.longitud !== undefined ? [dispositivo.latitud, dispositivo.longitud] : null;
  // La línea termina en el GPS si sigue en el lote al que llegó; si ya se movió, en ese lote.
  const sigueAhi = Boolean(destino && dispositivo.loteActual?.id === destino.id);
  const inicio = anterior ? puntoDentro(anterior) : null;
  const fin = destino ? (sigueAhi && posicion ? posicion : puntoDentro(destino)) : null;

  const limites = useMemo(() => (establecimiento ? L.geoJSON(establecimiento).getBounds() : null), [establecimiento]);
  const momento = cambio ? new Date(cambio.momento) : null;

  let leyenda: string;
  if (!cambio) leyenda = "Todavía no hay cambios de lote registrados para este GPS.";
  else if (!destino) leyenda = "El lote al que llegó ya no está activo.";
  else if (anterior) leyenda = `Pasó del ${nombreLote(anterior)} al ${nombreLote(destino)}`;
  else if (cambio.loteAnteriorId) leyenda = `Llegó al ${nombreLote(destino)}. El lote de donde venía ya no está activo.`;
  else leyenda = `Entró al ${nombreLote(destino)} desde afuera de los lotes`;

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border-2 border-[var(--color-campo-100)] bg-white p-4" aria-label="Último cambio de lote">
      <div>
        <div className="flex items-center gap-1.5">
          <p className="m-0 text-[0.68rem] font-bold tracking-[0.08em] text-[var(--color-campo-700)] uppercase">Último cambio de lote</p>
          <AvisoInfo tono="info" titulo="Cómo leer el mapa">
            <p className="m-0">El punto naranja marca el lote de donde salió, no la posición exacta, y la línea sólo une los dos lotes: no es el recorrido del animal.</p>
          </AvisoInfo>
        </div>
        <p className="m-0 mt-1 text-[0.95rem] font-semibold text-gray-900">
          {leyenda}
          {momento && destino && <span className="font-normal text-gray-500"> · {momento.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
        </p>
      </div>

      {limites && limites.isValid() ? (
        <div className="relative isolate aspect-[4/3] w-full overflow-hidden rounded-2xl miniatura-compacta">
          <MapContainer
            bounds={limites}
            boundsOptions={{ padding: [18, 18] }}
            zoomSnap={0}
            maxZoom={19}
            dragging={false}
            zoomControl={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            touchZoom={false}
            boxZoom={false}
            keyboard={false}
            attributionControl={false}
            style={{ height: "100%", width: "100%", background: "#1b2420" }}
          >
            <Reencuadrar limites={limites} />
            {/* El crédito de Esri no se saca: lo piden sus términos y es la fuente real de la imagen. */}
            <AttributionControl position="bottomright" prefix={false} />
            <TileLayer
              attribution="Imágenes &copy; Esri, Maxar, Earthstar Geographics"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={17}
            />
            {establecimiento && <GeoJSON data={establecimiento} interactive={false} style={{ color: "#ffde67", weight: 2, fill: false }} />}
            {lotes.map((lote) => {
              const esAnterior = lote.id === anterior?.id;
              const esDestino = lote.id === destino?.id;
              return (
                <GeoJSON
                  key={`${lote.id}-${esAnterior}-${esDestino}`}
                  data={lote.polygon}
                  interactive={false}
                  style={esDestino
                    ? { color: LIMA, weight: 2.5, fillColor: LIMA, fillOpacity: 0.3 }
                    : esAnterior
                      ? { color: AMBAR, weight: 2.5, fillColor: AMBAR, fillOpacity: 0.25 }
                      : { color: "#ffffff", weight: 1, opacity: 0.55, fill: false }}
                />
              );
            })}
            {inicio && fin && <Polyline positions={[inicio, fin]} interactive={false} pathOptions={{ color: "#ffffff", weight: 3, dashArray: "6 7", opacity: 0.95 }} />}
            {inicio && anterior && (
              <CircleMarker center={inicio} radius={6} pathOptions={{ color: "#ffffff", weight: 2, fillColor: AMBAR, fillOpacity: 1 }}>
                <Tooltip permanent direction="top" offset={[0, -6]} className="lote-tip"><span className="lote-tip-nombre">Lote {anterior.numero}</span></Tooltip>
              </CircleMarker>
            )}
            {fin && destino && !sigueAhi && (
              <CircleMarker center={fin} radius={5} pathOptions={{ color: "#ffffff", weight: 2, fillColor: LIMA, fillOpacity: 1 }} />
            )}
            {posicion && (
              <CircleMarker center={posicion} radius={7} pathOptions={{ color: "#ffffff", weight: 2.5, fillColor: ROJO, fillOpacity: 1 }}>
                <Tooltip permanent direction="top" offset={[0, -8]} className="lote-tip"><span className="lote-tip-nombre">{destino && sigueAhi ? `Ahora · Lote ${destino.numero}` : "Ahora"}</span></Tooltip>
              </CircleMarker>
            )}
          </MapContainer>
        </div>
      ) : (
        <p className="m-0 text-sm text-gray-500">Sin límite del establecimiento para mostrar.</p>
      )}

      {/* El rótulo de simulación queda siempre a la vista (CLAUDE.md); la explicación del mapa va en el ícono. */}
      <p className="m-0 text-[0.66rem] font-medium tracking-wide text-gray-400">Simulación de GPS · no es un dato real</p>
    </section>
  );
}
