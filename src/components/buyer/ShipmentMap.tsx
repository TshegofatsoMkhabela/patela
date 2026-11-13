"use client";

/**
 * The focused shipment's map. Client-only (deck.gl + Google Maps never reach the server).
 * 3D: vector map, camera locked behind the truck at 67.5° tilt, creeping along at its live position.
 * Flat: the same map in raster mode, whole route with the truck as a dot.
 * Ported from the truck-tracker demo, minus its cinematic sequence and hidden pre-load map
 * (that doubled map loads, and so cost, on every dashboard view).
 */
import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { GoogleMapsOverlay } from "@deck.gl/google-maps";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { ScenegraphLayer } from "@deck.gl/mesh-layers";
import {
  chooseMapMode,
  headingAt,
  initialMapMode,
  makeRoute,
  pointAt,
  progressAt,
  type LngLat,
  type MapMode,
  type Route,
  type Shipment,
} from "@/lib/buyer-shipments";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
const TRUCK_MODEL = "/buyer/models/truck/patela-truck.gltf";

const CAM = { zoom: 18.6, tilt: 67.5, headingRate: 2.2 };
const ROUTE_RED: [number, number, number] = [247, 61, 45];
const NAVY: [number, number, number] = [1, 23, 45];
/** The flat map's camera is still and the dot moves under a pixel a second: redraw once a second. */
const FLAT_REDRAW_MS = 1000;

const angleDelta = (from: number, to: number) => ((to - from + 540) % 360) - 180;

/** Everything derived from a route file, built once per route and cached for the page's life. */
interface LoadedRoute {
  route: Route;
  /** Stable array identity, so deck.gl doesn't re-tessellate the path. */
  data: { path: LngLat[] }[];
  bounds: google.maps.LatLngBoundsLiteral;
}

const routeCache = new Map<string, Promise<LoadedRoute>>();
function loadRoute(id: string) {
  if (!routeCache.has(id)) {
    routeCache.set(
      id,
      fetch(`/buyer/routes/${id}.json`)
        .then((r) => {
          if (!r.ok) throw new Error(`route ${id}: ${r.status}`);
          return r.json() as Promise<{ path: LngLat[] }>;
        })
        .then(({ path }) => {
          const lngs = path.map((p) => p[0]);
          const lats = path.map((p) => p[1]);
          return {
            route: makeRoute(path),
            data: [{ path }],
            bounds: {
              west: Math.min(...lngs),
              east: Math.max(...lngs),
              south: Math.min(...lats),
              north: Math.max(...lats),
            },
          };
        }),
    );
  }
  return routeCache.get(id)!;
}

function hasWebGL2() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

export default function ShipmentMap({
  shipment,
  onModeChange,
}: {
  shipment: Shipment;
  onModeChange?: (mode: MapMode) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const shipmentRef = useRef(shipment);
  shipmentRef.current = shipment;
  const [mode, setMode] = useState(() => initialMapMode(!!API_KEY));
  const [ready, setReady] = useState(false);

  useEffect(() => onModeChange?.(mode), [mode, onModeChange]);

  // One map per mount; the effect below swaps routes when the focused shipment changes.
  const live = useRef<{
    map: google.maps.Map;
    overlay: GoogleMapsOverlay;
    mode: MapMode;
    loaded: LoadedRoute | null;
    routeLayer: PathLayer<{ path: LngLat[] }> | null;
    heading: number | null;
    lastFlatDraw: number;
  } | null>(null);

  useEffect(() => {
    if (!API_KEY || !el.current) return;
    let cancelled = false;
    let frame = 0;
    // ?flat forces the flat fallback, to check it on a machine that has 3D.
    const webgl2 = hasWebGL2() && !new URLSearchParams(window.location.search).has("flat");

    const settle = (renderingType: string | null, loadFailed = false) => {
      const next = chooseMapMode({
        hasKey: true,
        loadFailed,
        webgl2,
        renderingType: renderingType as "VECTOR" | "RASTER" | "UNINITIALIZED" | null,
      });
      if (live.current) live.current.mode = next;
      setMode(next);
    };

    (async () => {
      try {
        const maps = await new Loader({ apiKey: API_KEY, version: "weekly" }).importLibrary("maps");
        if (cancelled || !el.current) return;
        const map = new maps.Map(el.current, {
          center: { lat: -29, lng: 25 },
          zoom: 6,
          mapId: MAP_ID,
          renderingType: webgl2 ? maps.RenderingType.VECTOR : maps.RenderingType.RASTER,
          disableDefaultUI: true,
          keyboardShortcuts: false,
          isFractionalZoomEnabled: true,
          gestureHandling: "none",
        });
        const overlay = new GoogleMapsOverlay({ interleaved: webgl2 });
        overlay.setMap(map);
        live.current = {
          map,
          overlay,
          mode: webgl2 ? "3d" : "flat",
          loaded: null,
          routeLayer: null,
          heading: null,
          lastFlatDraw: 0,
        };
        settle(webgl2 ? null : "RASTER");
        setReady(true);
        // RenderingType's values are the strings chooseMapMode expects.
        map.addListener("renderingtype_changed", () => settle(map.getRenderingType()));

        let last = performance.now();
        const tick = (now: number) => {
          frame = requestAnimationFrame(tick);
          const dt = Math.min(0.1, (now - last) / 1000);
          last = now;
          const L = live.current;
          if (!L?.loaded || !L.routeLayer) return;
          if (L.mode !== "3d" && now - L.lastFlatDraw < FLAT_REDRAW_MS) return;

          const { route } = L.loaded;
          const fraction = progressAt(shipmentRef.current, Date.now());
          const at = pointAt(route, fraction);

          if (L.mode === "3d") {
            const road = headingAt(route, fraction);
            L.heading =
              L.heading === null
                ? road
                : (L.heading +
                    angleDelta(L.heading, road) * Math.min(1, CAM.headingRate * dt) +
                    360) %
                  360;
            L.map.moveCamera({
              center: { lat: at[1], lng: at[0] },
              zoom: CAM.zoom,
              heading: L.heading,
              tilt: CAM.tilt,
            });
            L.overlay.setProps({
              layers: [
                L.routeLayer,
                new ScenegraphLayer<{ position: LngLat; heading: number }>({
                  id: "truck",
                  data: [{ position: at, heading: L.heading }],
                  scenegraph: TRUCK_MODEL,
                  sizeScale: 2,
                  sizeMinPixels: 22,
                  sizeMaxPixels: 66,
                  getPosition: (d) => d.position,
                  getOrientation: (d) => [0, 180 - d.heading, 90],
                  _lighting: "pbr",
                }),
              ],
            });
          } else {
            L.lastFlatDraw = now;
            L.overlay.setProps({
              layers: [
                L.routeLayer,
                new ScatterplotLayer<{ position: LngLat }>({
                  id: "truck-dot",
                  data: [{ position: at }],
                  getPosition: (d) => d.position,
                  getFillColor: NAVY,
                  getLineColor: [255, 255, 255],
                  stroked: true,
                  lineWidthUnits: "pixels",
                  getLineWidth: 3,
                  radiusUnits: "pixels",
                  getRadius: 8,
                }),
              ],
            });
          }
        };
        frame = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) settle(null, true);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      live.current?.overlay.finalize();
      live.current = null;
    };
  }, []);

  // Swap routes when the focused shipment (or the map mode) changes; flat mode frames the whole route.
  useEffect(() => {
    let stale = false;
    loadRoute(shipment.routeId)
      .then((loaded) => {
        const L = live.current;
        if (stale || !L) return;
        L.loaded = loaded;
        L.heading = null;
        L.lastFlatDraw = 0;
        L.routeLayer = new PathLayer<{ path: LngLat[] }>({
          id: "route",
          data: loaded.data,
          getPath: (d) => d.path,
          getColor: ROUTE_RED,
          widthUnits: "pixels",
          getWidth: L.mode === "3d" ? 6 : 4,
          jointRounded: true,
          capRounded: true,
        });
        if (L.mode !== "3d") L.map.fitBounds(loaded.bounds, 48);
      })
      .catch(() => !stale && setMode("none"));
    return () => {
      stale = true;
    };
  }, [shipment.routeId, mode, ready]);

  if (mode === "none") return null;
  return <div ref={el} className="bd-map-canvas" aria-hidden="true" />;
}
