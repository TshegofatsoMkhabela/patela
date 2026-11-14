// deck.gl
// SPDX-License-Identifier: MIT
// Copyright (c) vis.gl contributors
//
// Patela demo: Cape Town -> Beaufort West along the N1. Simulated shipment, not live GPS.
//
// Beats: overview of South Africa -> route draws -> "Start journey" -> camera flies into Cape Town
// and the truck pulls away -> for every leg, a smooth zoom out and back in:
//   rise    the truck disappears, the camera zooms out to top-down
//   pan     top-down glide toward the next city while the route fills in behind
//   hover   only if needed: hold in the sky until the destination's tiles are pre-loaded
//   descend zoom back down, landing behind the truck 500 m before the city
//   approach the truck drives the last 500 m at road pace with the camera locked behind it
// -> in the city it creeps on until Verify is pressed -> next leg -> delivery confirmed in
// Beaufort West -> camera pulls back to the whole route.
//
// Smoothness ("pre-plan + pre-load"):
//  1. Camera moves are pure functions of elapsed time; the street-level drives are simulated up
//     front at a fixed 60 Hz into frame tables, so frame drops never change the path.
//  2. A hidden second map flies the planned views ahead of time so tiles are cached before the
//     real camera arrives; the hover beat waits for that instead of descending into blank tiles.
//  3. Route reveal / driven line are TripsLayers: geometry uploaded once, only currentTime changes.
//  4. deck.gl draws interleaved in the map's own WebGL context (vector map), same frame as the map.

/* global fetch, requestAnimationFrame, cancelAnimationFrame, performance */
import { GoogleMapsOverlay as DeckOverlay } from "@deck.gl/google-maps";
import { ScenegraphLayer } from "@deck.gl/mesh-layers";
import { ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { Loader } from "@googlemaps/js-api-loader";

// Road geometry for the N1, from OSRM. This demo ends at Beaufort West.
import route from "./n1-route.json";

const MODELS = [
  // Sketchfab "Low Poly Truck" by Arifido._ (CC BY 4.0). Measured from scene.gltf: Y-up, length
  // along Z, 1.31 x 1.71 x 4.48 units -> x2 ≈ a 9 m truck. Facing confirmed in Chrome.
  {
    url: "models/patela-truck.gltf",
    sizeScale: 2,
    minPixels: 22,
    orientation: (h) => [0, 180 - h, 90],
    credit: true,
  },
  {
    url: "https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/google-3d/truck.gltf",
    sizeScale: 2,
    minPixels: 20,
    orientation: (h) => [0, 180 - h, 90],
    credit: false,
  },
];

const PARAMS = new URLSearchParams(window.location.search);
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FAST = PARAMS.has("fast") ? 0.25 : 1; // ?fast: every beat at 1/4 duration, for testing
const WARM = !PARAMS.has("nowarm"); // ?nowarm: skip tile pre-loading, to compare
const MOTION = (REDUCED ? 0.15 : 1) * FAST;

const TIMING = {
  draw: 2400 * MOTION, // route draws itself across the country
  fly: 4200 * MOTION, // overview -> Cape Town street level
  depart: 5000 * FAST, // truck pulls away from Cape Town before the first switch
  rise: 2400 * MOTION, // street -> sky
  panBase: 2200 * MOTION, // top-down glide...
  panPerKm: 4 * MOTION, // ...a little longer for longer legs
  hoverMax: 6000, // never wait in the sky longer than this for tiles
  descend: 2800 * MOTION, // sky -> street behind the truck
  outro: 3400 * MOTION, // Beaufort West -> overview
  verifyHold: 450, // show "Verified" before the switch starts
  warmGateMax: 20000, // never keep Start disabled longer than this
};

// Street-level framing follows the Google WebGL car demo (benzoadrian/Google-Maps-API-3D-car-game):
// locked behind the vehicle, vehicle centred, 67.5° tilt (vector map max).
const CAM = {
  cityZoom: 18.6,
  cityTilt: 67.5,
  headingRate: 2.2, // how quickly the camera swings round behind the truck (1/s)
  creepSpeed: 7, // m/s (~25 km/h) while waiting for Verify in a city
  approachMeters: 500, // street-level drive into every city
  handoffPromptMeters: 100, // offer checkpoint verification before the truck arrives
  approachEntrySpeed: 45, // m/s (~162 km/h) at touchdown, then even braking to arrival speed
};

// Seconds the final 500 m takes, braking evenly from approachEntrySpeed to the arrival speed
// (creep in a city, 0 at the destination): ~19 s into a checkpoint, ~22 s into Beaufort West.
const approachSeconds = (arrivalSpeed) =>
  ((2 * CAM.approachMeters) / (CAM.approachEntrySpeed + arrivalSpeed)) * FAST * (REDUCED ? 0.2 : 1);

const SIM_HZ = 60;

const COLOR = {
  routeIdle: [71, 85, 105, 110],
  routeDrawn: [71, 85, 105, 200],
  driven: [13, 148, 136],
  pending: [255, 255, 255, 255],
  pendingLine: [71, 85, 105, 255],
  active: [245, 158, 11, 255],
  verified: [22, 163, 74, 255],
};

// ---------- geometry ----------

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

function haversine(a, b) {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(s));
}

function bearing(a, b) {
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x =
    Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) -
    Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const angleDelta = (from, to) => ((to - from + 540) % 360) - 180;
const wrap360 = (a) => ((a % 360) + 360) % 360;

class Polyline {
  constructor(points) {
    this.points = points;
    this.cum = new Float64Array(points.length);
    for (let i = 1; i < points.length; i++) {
      this.cum[i] = this.cum[i - 1] + haversine(points[i - 1], points[i]);
    }
    this.length = this.cum[points.length - 1];
  }

  indexAt(d) {
    let lo = 0;
    let hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= d) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  pointAt(d) {
    d = Math.max(0, Math.min(this.length, d));
    const i = this.indexAt(d);
    const j = Math.min(i + 1, this.points.length - 1);
    const span = this.cum[j] - this.cum[i] || 1;
    const t = (d - this.cum[i]) / span;
    const a = this.points[i];
    const b = this.points[j];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  // Road heading across a window, so single kinks in the OSM line don't twitch anything.
  headingAt(d, window) {
    return bearing(this.pointAt(d - window / 2), this.pointAt(d + window / 2));
  }

  nearestDistance(p) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.points.length; i++) {
      const dx = this.points[i][0] - p[0];
      const dy = this.points[i][1] - p[1];
      const dd = dx * dx + dy * dy;
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    }
    return this.cum[best];
  }
}

// ---------- easing ----------

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (current, target, rate, dt) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));
const approachAngle = (current, target, rate, dt) =>
  wrap360(current + angleDelta(current, target) * (1 - Math.exp(-rate * dt)));

// Cubic Hermite position: starts at `a` moving at v0 (m/s), ends at `b` moving at v1, over T s.
function hermite(u, a, b, v0, v1, T) {
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * a +
    (u3 - 2 * u2 + u) * v0 * T +
    (-2 * u3 + 3 * u2) * b +
    (u3 - u2) * v1 * T
  );
}

// ---------- pre-planned street-level drives ----------

const F = 4; // floats per frame: truckDist, truckHeading, camHeading, (spare)

// A street-level drive (Cape Town departure, or the final 500 m into a city), simulated at a fixed
// rate. Camera stays at city zoom/tilt, centred on the truck, heading eased round behind it.
function planDrive(line, { from, to, v0, v1, seconds, camHeading0, truckHeading0 }) {
  const n = Math.max(2, Math.ceil(seconds * SIM_HZ));
  const dt = seconds / n;
  const frames = new Float64Array((n + 1) * F);
  let camHeading = camHeading0;
  let truckHeading = truckHeading0;
  for (let k = 0; k <= n; k++) {
    const d = hermite(k / n, from, to, v0, v1, seconds);
    if (k > 0) {
      truckHeading = approachAngle(truckHeading, line.headingAt(d, 120), 8, dt);
      camHeading = approachAngle(camHeading, truckHeading, CAM.headingRate, dt);
    }
    frames.set([d, truckHeading, camHeading, 0], k * F);
  }
  return { frames, n, durationMs: seconds * 1000 };
}

function sampleDrive(plan, elapsedMs) {
  const f = clamp01(elapsedMs / plan.durationMs) * plan.n;
  const i = Math.min(plan.n - 1, Math.floor(f));
  const r = f - i;
  const a = i * F;
  const b = (i + 1) * F;
  const fr = plan.frames;
  return {
    truckDist: lerp(fr[a], fr[b], r),
    truckHeading: wrap360(fr[a + 1] + angleDelta(fr[a + 1], fr[b + 1]) * r),
    camHeading: wrap360(fr[a + 2] + angleDelta(fr[a + 2], fr[b + 2]) * r),
  };
}

// ---------- camera moves ----------

const toLatLng = (p) => ({ lat: p[1], lng: p[0] });

function tween(from, to, pan, zoomT, rot) {
  return {
    center: {
      lat: lerp(from.center.lat, to.center.lat, pan),
      lng: lerp(from.center.lng, to.center.lng, pan),
    },
    zoom: lerp(from.zoom, to.zoom, zoomT),
    heading: wrap360(from.heading + angleDelta(from.heading, to.heading) * rot),
    tilt: lerp(from.tilt, to.tilt, rot),
  };
}

function flyCamera(from, to, t) {
  // Pan leads, zoom follows: travel while high, then descend onto the truck.
  const pan = easeInOutCubic(clamp01(t / 0.75));
  const zoomT = easeInOutCubic(clamp01((t - 0.2) / 0.8));
  const rot = easeInOutCubic(clamp01((t - 0.45) / 0.55));
  return tween(from, to, pan, zoomT, rot);
}

function outroCamera(from, to, t) {
  const rot = easeInOutCubic(clamp01(t / 0.5));
  const zoomT = easeInOutCubic(clamp01(t / 0.8));
  const pan = easeInOutCubic(clamp01((t - 0.1) / 0.9));
  return tween(from, to, pan, zoomT, rot);
}

// Smooth zoom out above the truck, then zoom back in behind it.
const riseCamera = (from, top, t) =>
  tween(from, { ...top, center: from.center }, 0, easeInOutCubic(t), easeInOutCubic(t));
const descendCamera = (top, street, t) =>
  tween({ ...top, center: street.center }, street, 0, easeInOutCubic(t), easeInOutCubic(t));

// Top-down zoom that fits both ends of the glide with margin, for this viewport and latitude.
function topZoom(container, a, b) {
  const minDim = Math.min(
    container.clientWidth || window.innerWidth,
    container.clientHeight || window.innerHeight,
  );
  const lat = (a[1] + b[1]) / 2;
  const metersPerPxAtZ0 = 156543.03 * Math.cos(toRad(lat));
  const z = Math.log2((metersPerPxAtZ0 * minDim) / (haversine(a, b) * 1.6));
  return Math.max(5.5, Math.min(12, z));
}

// ---------- tile pre-loading ----------

function createWarmer(googlemaps, el, options) {
  const map = new googlemaps.Map(el, {
    ...options,
    gestureHandling: "none",
    disableDefaultUI: true,
  });
  const queue = [];
  const stats = [];
  let paused = false;
  let resume = null;
  let running = false;

  // Resolve when the view's tiles are in, or shortly after the map goes idle (already cached),
  // or after a timeout so one slow tile never stalls the queue.
  const settle = () =>
    new Promise((resolve) => {
      let done = false;
      const finish = (loaded) => {
        if (done) return;
        done = true;
        a.remove();
        b.remove();
        resolve(loaded);
      };
      const a = map.addListener("tilesloaded", () => finish(true));
      const b = map.addListener("idle", () => setTimeout(() => finish(true), 250));
      setTimeout(() => finish(false), 2500);
    });

  async function run() {
    running = true;
    while (queue.length) {
      const job = queue[0];
      while (job.i < job.views.length) {
        if (paused) await new Promise((r) => (resume = r));
        const t0 = performance.now();
        map.moveCamera(job.views[job.i]);
        const loaded = await settle();
        stats.push({ job: job.name, ms: Math.round(performance.now() - t0), loaded });
        job.i += 1;
        job.onProgress?.(job.i / job.views.length);
      }
      queue.shift();
      job.resolve();
    }
    running = false;
  }

  return {
    enqueue(name, views, onProgress) {
      return new Promise((resolve) => {
        queue.push({ name, views, i: 0, resolve, onProgress });
        if (!running) run();
      });
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      resume?.();
      resume = null;
    },
    stats,
  };
}

// ---------- app ----------

export async function renderToDOM(container) {
  const GOOGLE_MAPS_API_KEY = window.PATELA_TRACKER_CONFIG?.apiKey;
  const GOOGLE_MAP_ID = window.PATELA_TRACKER_CONFIG?.mapId || "DEMO_MAP_ID";
  if (!GOOGLE_MAPS_API_KEY) {
    container.innerHTML =
      '<div style="padding:24px;font:16px sans-serif">The route tracker needs a Google Maps browser key in the deployment environment.</div>';
    return null;
  }

  const destinationIndex = route.stops.findIndex((stop) => stop.name === "Beaufort West");
  if (destinationIndex < 1) throw new Error("Beaufort West is missing from the route");
  const fullLine = new Polyline(route.path);
  const endIndex = fullLine.indexAt(
    fullLine.nearestDistance(route.stops[destinationIndex].location),
  );
  const line = new Polyline(route.path.slice(0, endIndex + 1));
  const stops = route.stops.slice(0, destinationIndex + 1).map((s, i) => ({
    ...s,
    distance: i === 0 ? 0 : i === destinationIndex ? line.length : line.nearestDistance(s.location),
    state: "pending", // pending | active | verified
  }));
  const last = stops.length - 1;
  const routeKm = Math.round(line.length / 1000);
  const model = await pickModel();

  const overview = overviewCamera(container, line);
  const loader = new Loader({ apiKey: GOOGLE_MAPS_API_KEY });
  const googlemaps = await loader.importLibrary("maps");
  const mapOptions = {
    center: overview.center,
    zoom: overview.zoom,
    heading: 0,
    tilt: 0,
    isFractionalZoomEnabled: true,
    mapId: GOOGLE_MAP_ID,
    // Ask for the WebGL vector map explicitly. Without it the map can come up as raster: no tilt,
    // image tiles that shear and leave grey gaps while the camera moves, and deck.gl drawn in a
    // separate pass a frame behind the map.
    renderingType: googlemaps.RenderingType.VECTOR,
    disableDefaultUI: true,
    keyboardShortcuts: false,
  };
  const map = new googlemaps.Map(container, { ...mapOptions, gestureHandling: "none" });
  const overlay = new DeckOverlay({ interleaved: true });
  overlay.setMap(map);
  // If the browser can't give Google a WebGL context it silently falls back to raster. Say so.
  map.addListener("renderingtype_changed", () => {
    const raster = map.getRenderingType() === googlemaps.RenderingType.RASTER;
    document.querySelector("[data-raster-warning]").hidden = !raster;
    if (raster) document.querySelector("[data-gl-diagnosis]").textContent = diagnoseWebGL();
  });

  const ui = createUI(stops, model, routeKm);

  // ----- planning -----
  const departMeters = 40; // Cape Town: truck pulls away this far before the first switch
  const arrivalSpeed = (leg) => (leg + 1 === last ? 0 : CAM.creepSpeed);
  const handoffDist = (leg) => stops[leg + 1].distance - CAM.approachMeters; // touchdown point
  const streetView = (d) => ({
    center: toLatLng(line.pointAt(d)),
    zoom: CAM.cityZoom,
    heading: line.headingAt(d, 120),
    tilt: CAM.cityTilt,
  });
  const topView = (leg, fromDist) => {
    const a = line.pointAt(fromDist);
    const b = line.pointAt(handoffDist(leg));
    return { zoom: topZoom(container, a, b), heading: 0, tilt: 0, a, b };
  };
  const panDuration = (fromDist, leg) =>
    TIMING.panBase + ((handoffDist(leg) - fromDist) / 1000) * TIMING.panPerKm;
  const approachPlan = (leg, camHeading0) =>
    planDrive(line, {
      from: handoffDist(leg),
      to: stops[leg + 1].distance,
      v0: CAM.approachEntrySpeed,
      v1: arrivalSpeed(leg),
      seconds: approachSeconds(arrivalSpeed(leg)),
      camHeading0,
      truckHeading0: line.headingAt(handoffDist(leg), 120),
    });
  const startView = streetView(0);

  // Views the hidden map visits ahead of time for one leg: the top-down glide, every step of the
  // descent onto the touchdown point, and the street-level approach into the city.
  function legViews(leg) {
    const fromDist = leg === 0 ? departMeters : stops[leg].distance;
    const top = topView(leg, fromDist);
    const street = streetView(handoffDist(leg));
    const views = [];
    for (const t of [0.25, 0.5, 0.75, 1]) {
      views.push({
        center: toLatLng([lerp(top.a[0], top.b[0], t), lerp(top.a[1], top.b[1], t)]),
        zoom: top.zoom,
        heading: 0,
        tilt: 0,
      });
    }
    for (const t of [0.33, 0.55, 0.7, 0.85, 1]) views.push(descendCamera(top, street, t));
    const plan = approachPlan(leg, street.heading);
    for (let k = 0; k <= plan.n; k += Math.round(SIM_HZ * 1.5)) {
      const d = plan.frames[k * F];
      views.push({ ...streetView(d), heading: plan.frames[k * F + 2] });
    }
    return views;
  }

  // ----- tile pre-loading -----
  const warmer = WARM
    ? createWarmer(googlemaps, document.getElementById("warm"), mapOptions)
    : null;
  const warmed = stops.map(() => !warmer); // warmed[leg]: destination of that leg is cached
  const flyViews = [0.2, 0.4, 0.55, 0.7, 0.8, 0.9, 1].map((t) =>
    flyCamera({ ...overview, heading: 0, tilt: 0 }, startView, t),
  );
  let startReady = Promise.resolve();
  if (warmer) {
    const progress = { fly: 0, leg0: 0 };
    const report = () => ui.setPreparing((progress.fly + progress.leg0) / 2);
    const leg0 = warmer
      .enqueue("leg0", legViews(0), (p) => ((progress.leg0 = p), report()))
      .then(() => (warmed[0] = true));
    startReady = Promise.race([
      Promise.all([warmer.enqueue("fly", flyViews, (p) => ((progress.fly = p), report())), leg0]),
      new Promise((r) => setTimeout(r, TIMING.warmGateMax)),
    ]);
    for (let leg = 1; leg < last; leg++)
      warmer.enqueue(`leg${leg}`, legViews(leg)).then(() => (warmed[leg] = true));
  }

  // ----- state -----
  const s = {
    phase: "intro", // intro|ready|fly|depart|rise|pan|hover|descend|approach|city|verified|outro|done
    phaseStart: performance.now(),
    leg: 0,
    plan: null,
    handoffPrompted: false,
    handoffVerified: false,
    top: null,
    legFrom: 0,
    truckDist: 0,
    truckHeading: line.headingAt(0, 120),
    truckOpacity: 1,
    drawnDist: 0,
    cam: { center: { ...overview.center }, zoom: overview.zoom, heading: 0, tilt: 0 },
    from: null,
  };
  const metrics = {};

  // The pre-loader only runs while the main map is cheap to draw (overview, sky, waiting in a city).
  const WARM_OK = new Set(["intro", "ready", "pan", "hover", "city", "verified", "done"]);

  const setPhase = (phase) => {
    s.phase = phase;
    s.phaseStart = performance.now();
    s.from = {
      center: { ...s.cam.center },
      zoom: s.cam.zoom,
      heading: s.cam.heading,
      tilt: s.cam.tilt,
    };
    map.setOptions({ gestureHandling: phase === "ready" || phase === "done" ? "greedy" : "none" });
    if (warmer) WARM_OK.has(phase) ? warmer.resume() : warmer.pause();
    ui.setPhase(phase, s);
  };

  const startSwitch = () => {
    s.legFrom = s.truckDist;
    s.top = topView(s.leg, s.legFrom);
    setPhase("rise");
  };

  ui.onStart = () => {
    stops[0].state = "verified"; // departure scan
    ui.refreshStops();
    setPhase("fly");
  };
  ui.onVerify = () => {
    stops[s.leg + 1].state = "verified";
    ui.refreshStops();
    s.handoffVerified = true;
    setPhase("verified");
  };
  ui.onReplay = () => {
    stops.forEach((st) => (st.state = "pending"));
    s.leg = 0;
    s.truckDist = 0;
    s.truckHeading = line.headingAt(0, 120);
    s.truckOpacity = 1;
    s.handoffPrompted = false;
    s.handoffVerified = false;
    ui.refreshStops();
    setPhase("ready");
  };

  setPhase("intro");

  // ----- frame loop -----
  let lastNow = performance.now();
  let raf = null;

  const frame = (now) => {
    const frameMs = now - lastNow;
    const dt = Math.min(0.05, frameMs / 1000);
    lastNow = now;
    const elapsed = now - s.phaseStart;
    const cam = s.cam;
    recordFrame(metrics, s.phase, frameMs);

    switch (s.phase) {
      case "intro": {
        const t = clamp01(elapsed / TIMING.draw);
        s.drawnDist = line.length * easeInOutSine(t);
        if (t >= 1) {
          setPhase("ready");
          ui.setPreparing(warmer ? 0 : 1);
          startReady.then(() => ui.setPreparing(1));
        }
        break;
      }
      case "ready":
      case "done":
        readCamera(map, cam);
        break;
      case "fly": {
        const t = clamp01(elapsed / TIMING.fly);
        Object.assign(cam, flyCamera(s.from, startView, t));
        if (t >= 1) {
          s.leg = 0;
          s.plan = planDrive(line, {
            from: 0,
            to: departMeters,
            v0: 0,
            v1: CAM.creepSpeed * 2,
            seconds: TIMING.depart / 1000,
            camHeading0: cam.heading,
            truckHeading0: s.truckHeading,
          });
          setPhase("depart");
        }
        break;
      }
      case "depart":
      case "approach": {
        // Street level, camera locked behind the truck (Cape Town pull-away, or the final 500 m).
        const f = sampleDrive(s.plan, elapsed);
        s.truckDist = f.truckDist;
        s.truckHeading = f.truckHeading;
        cam.center = toLatLng(line.pointAt(f.truckDist));
        cam.heading = f.camHeading;
        cam.zoom = CAM.cityZoom;
        cam.tilt = CAM.cityTilt;
        if (
          s.phase === "approach" &&
          s.leg + 1 !== last &&
          !s.handoffPrompted &&
          stops[s.leg + 1].distance - s.truckDist <= CAM.handoffPromptMeters
        ) {
          s.handoffPrompted = true;
          ui.showHandoff(s);
        }
        if (elapsed >= s.plan.durationMs) {
          if (s.phase === "depart") {
            startSwitch();
          } else {
            if (!s.handoffVerified) stops[s.leg + 1].state = "active";
            ui.refreshStops();
            setPhase(s.handoffVerified ? "verified" : "city");
          }
        }
        break;
      }
      case "rise": {
        const t = clamp01(elapsed / TIMING.rise);
        Object.assign(cam, riseCamera(s.from, s.top, t));
        s.truckOpacity = 1 - clamp01(t * 4); // gone by the end of the first step
        if (t >= 1) setPhase("pan");
        break;
      }
      case "pan": {
        const t = clamp01(elapsed / panDuration(s.legFrom, s.leg));
        const p = easeInOutCubic(t);
        const { a, b } = s.top;
        cam.center = toLatLng([lerp(a[0], b[0], p), lerp(a[1], b[1], p)]);
        cam.zoom = s.top.zoom;
        cam.heading = 0;
        cam.tilt = 0;
        s.truckDist = lerp(s.legFrom, handoffDist(s.leg), p); // route fills in behind the glide
        if (t >= 1) setPhase(warmed[s.leg] ? "descend" : "hover");
        break;
      }
      case "hover":
        // Wait at the zoomed-out view until destination tiles are loaded.
        if (warmed[s.leg] || elapsed >= TIMING.hoverMax) setPhase("descend");
        break;
      case "descend": {
        const t = clamp01(elapsed / TIMING.descend);
        const street = streetView(handoffDist(s.leg));
        Object.assign(cam, descendCamera(s.top, street, t));
        s.truckDist = handoffDist(s.leg);
        s.truckHeading = street.heading;
        s.truckOpacity = clamp01((t - 0.75) * 4); // back in during the last step
        if (t >= 1) {
          s.truckOpacity = 1;
          s.plan = approachPlan(s.leg, cam.heading);
          s.handoffPrompted = false;
          s.handoffVerified = false;
          setPhase("approach");
        }
        break;
      }
      case "city":
      case "verified": {
        // Locked behind the truck as it creeps on toward the next stop.
        const atEnd = s.leg + 1 === last;
        if (!atEnd) s.truckDist = Math.min(line.length - 50, s.truckDist + CAM.creepSpeed * dt);
        s.truckHeading = approachAngle(s.truckHeading, line.headingAt(s.truckDist, 120), 8, dt);
        cam.center = toLatLng(line.pointAt(s.truckDist));
        cam.heading = approachAngle(cam.heading, s.truckHeading, CAM.headingRate, dt);
        cam.zoom = approach(cam.zoom, CAM.cityZoom, 2, dt);
        cam.tilt = approach(cam.tilt, CAM.cityTilt, 2, dt);
        if (s.phase === "verified" && elapsed >= TIMING.verifyHold) {
          if (atEnd) {
            setPhase("outro");
          } else {
            s.leg += 1;
            startSwitch();
          }
        }
        break;
      }
      case "outro": {
        const t = clamp01(elapsed / TIMING.outro);
        Object.assign(
          cam,
          outroCamera(s.from, { ...overviewCamera(container, line), heading: 0, tilt: 0 }, t),
        );
        if (t >= 1) setPhase("done");
        break;
      }
      default:
        break;
    }

    if (s.phase !== "ready" && s.phase !== "done") {
      map.moveCamera({ center: cam.center, zoom: cam.zoom, heading: cam.heading, tilt: cam.tilt });
    }
    overlay.setProps({ layers: layers.build(s, now) });
    raf = requestAnimationFrame(frame);
  };

  const layers = createLayers(line, stops, model);
  raf = requestAnimationFrame(frame);

  // test/debug handle
  window.__journey = {
    get phase() {
      return s.phase;
    },
    get leg() {
      return s.leg;
    },
    get stops() {
      return stops.map((st) => ({
        name: st.name,
        state: st.state,
        km: Math.round(st.distance / 1000),
      }));
    },
    get truckKm() {
      return +(s.truckDist / 1000).toFixed(2);
    },
    get camera() {
      return { ...s.cam };
    },
    warmed,
    metrics,
    warmStats: warmer ? warmer.stats : null,
    renderingType: () => map.getRenderingType && map.getRenderingType(),
    model: model.url,
  };

  return { remove: () => cancelAnimationFrame(raf) };
}

// What WebGL this browser actually offers. Google's vector map needs a hardware WebGL2 context;
// it gives up (raster) if the context would carry a "major performance caveat" (software GL).
function diagnoseWebGL() {
  const probe = (opts) => {
    const gl = document.createElement("canvas").getContext("webgl2", opts);
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  };
  const hardware = probe({ failIfMajorPerformanceCaveat: true });
  const any = probe({});
  const msg = `WebGL2 hardware: ${hardware ? "yes" : "NO"} · WebGL2 any: ${any ? "yes" : "NO"} · Renderer: ${any || "none"}`;
  console.warn("[route-tracker]", msg); // eslint-disable-line
  return msg;
}

// Frame-time stats per phase: how many frames, how many slow ones, worst frame.
function recordFrame(metrics, phase, ms) {
  const m = (metrics[phase] ||= { frames: 0, over20ms: 0, over33ms: 0, worstMs: 0 });
  m.frames += 1;
  if (ms > 20) m.over20ms += 1;
  if (ms > 33) m.over33ms += 1;
  m.worstMs = Math.max(m.worstMs, Math.round(ms));
}

function overviewCamera(container, line) {
  // Fit the route with room for the shipment panel.
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  const mercY = (lat) => toDeg(Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2)));
  const lngs = line.points.map((point) => point[0]);
  const lats = line.points.map((point) => point[1]);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const zoom = Math.min(
    Math.log2((w * 360) / (256 * Math.max(0.5, east - west) * 1.7)),
    Math.log2((h * 360) / (256 * Math.max(0.5, mercY(north) - mercY(south)) * 1.7)),
  );
  return { center: { lat: (south + north) / 2, lng: (west + east) / 2 }, zoom };
}

function readCamera(map, cam) {
  const c = map.getCenter();
  if (!c) return;
  cam.center = { lat: c.lat(), lng: c.lng() };
  cam.zoom = map.getZoom();
  cam.heading = map.getHeading() || 0;
  cam.tilt = map.getTilt() || 0;
}

// ---------- layers ----------

// Data arrays are created once and only swapped when something actually changes, so deck.gl
// does not rebuild GPU buffers every frame. Per-frame motion goes through uniforms/one instance.
function createLayers(line, stops, model) {
  const routeData = [{ path: line.points, timestamps: Array.from(line.cum) }];
  let stopKey = "";
  let stopData = [];

  return {
    build(s, now) {
      const intro = s.phase === "intro";
      const key = stops
        .map((st) => st.state + (intro && st.distance > s.drawnDist + 1 ? "h" : ""))
        .join();
      if (key !== stopKey) {
        stopKey = key;
        stopData = stops
          .filter((st) => !intro || st.distance <= s.drawnDist + 1)
          .map((st) => ({ ...st }));
      }
      const pulse = REDUCED ? 0.5 : (Math.sin(now / 320) + 1) / 2;
      const showTruck = !intro && s.truckOpacity > 0.01;

      return [
        new TripsLayer({
          id: "route",
          data: routeData,
          getPath: (d) => d.path,
          getTimestamps: (d) => d.timestamps,
          getColor: intro ? COLOR.routeDrawn : COLOR.routeIdle,
          currentTime: intro ? s.drawnDist : line.length + 1,
          trailLength: line.length * 2,
          fadeTrail: false,
          widthUnits: "pixels",
          getWidth: 4,
          jointRounded: true,
          capRounded: true,
          updateTriggers: { getColor: intro },
        }),
        new TripsLayer({
          id: "driven",
          data: routeData,
          getPath: (d) => d.path,
          getTimestamps: (d) => d.timestamps,
          getColor: COLOR.driven,
          currentTime: s.truckDist,
          trailLength: line.length * 2,
          fadeTrail: false,
          widthUnits: "pixels",
          getWidth: 6,
          jointRounded: true,
          capRounded: true,
          visible: s.truckDist > 0,
        }),
        new ScatterplotLayer({
          id: "stop-halo",
          data: stopData,
          getPosition: (d) => d.location,
          getFillColor: (d) => (d.state === "active" ? COLOR.active : [0, 0, 0, 0]),
          radiusUnits: "pixels",
          getRadius: 12,
          radiusScale: 1 + 1.2 * pulse, // uniform: no attribute rebuild per frame
          opacity: 0.35 * (1 - pulse),
          updateTriggers: { getFillColor: stopKey },
        }),
        new ScatterplotLayer({
          id: "stops",
          data: stopData,
          getPosition: (d) => d.location,
          getFillColor: (d) =>
            d.state === "verified"
              ? COLOR.verified
              : d.state === "active"
                ? COLOR.active
                : COLOR.pending,
          getLineColor: (d) => (d.state === "pending" ? COLOR.pendingLine : [255, 255, 255, 255]),
          stroked: true,
          lineWidthUnits: "pixels",
          getLineWidth: 2.5,
          radiusUnits: "pixels",
          getRadius: 8,
        }),
        new TextLayer({
          id: "stop-labels",
          data: stopData,
          getPosition: (d) => d.location,
          getText: (d) => d.name,
          getSize: 13,
          getColor: [15, 23, 42, 255],
          fontFamily: 'Inter, "Helvetica Neue", Arial, sans-serif',
          fontWeight: 600,
          getPixelOffset: [0, -22],
          // no box: dark text with a thin halo, like Google's own map labels
          fontSettings: { sdf: true },
          outlineWidth: 2,
          outlineColor: [255, 255, 255, 220],
        }),
        showTruck &&
          new ScenegraphLayer({
            id: "truck",
            data: [{ position: line.pointAt(s.truckDist), heading: s.truckHeading }],
            scenegraph: model.url,
            sizeScale: model.sizeScale,
            // Pixels per model unit; at low zoom a real-size truck is a few pixels, so the min clamp
            // is what sizes it there.
            sizeMinPixels: model.minPixels,
            sizeMaxPixels: model.minPixels * 3,
            getPosition: (d) => d.position,
            getOrientation: (d) => model.orientation(d.heading),
            opacity: s.truckOpacity,
            _lighting: "pbr",
          }),
      ];
    },
  };
}

// ---------- model ----------

async function pickModel() {
  try {
    const res = await fetch(MODELS[0].url, { method: "HEAD" });
    const type = res.headers.get("content-type") || "";
    if (res.ok && !type.includes("text/html")) return MODELS[0];
  } catch (e) {
    // fall through to the sample truck
  }
  return MODELS[1];
}

// ---------- DOM UI ----------

function createUI(stops, model, routeKm) {
  const root = document.getElementById("ui");
  const stepper = root.querySelector("[data-stepper]");
  const card = root.querySelector("[data-card]");
  const eyebrow = card.querySelector("[data-eyebrow]");
  const title = card.querySelector("[data-title]");
  const body = card.querySelector("[data-body]");
  const button = card.querySelector("[data-action]");
  const status = card.querySelector("[data-status]");
  root.querySelector("[data-model-credit]").hidden = !model.credit;
  root.querySelector("[data-model-fallback]").hidden = model.credit;

  const ui = { onStart: null, onVerify: null, onReplay: null };
  let action = null;
  let ready = false; // Start stays disabled until the first legs' tiles are pre-loaded

  window.addEventListener("patela:handoff-result", (event) => {
    if (action !== "verify") return;
    if (!event.detail?.accepted) {
      button.disabled = false;
      button.textContent = "Verify handoff";
      return;
    }
    button.dataset.state = "done";
    button.textContent = "Verified";
    hideCard(TIMING.verifyHold);
    ui.onVerify();
  });

  button.addEventListener("click", () => {
    if (button.disabled) return;
    button.disabled = true; // one click per beat; a double-click must not restart anything
    if (action === "verify") {
      button.textContent = "Opening camera…";
      window.dispatchEvent(new Event("patela:verify-handoff"));
    } else if (action === "start") {
      hideCard(0);
      ui.onStart();
    } else if (action === "replay") {
      hideCard(0);
      ui.onReplay();
    }
  });

  function showCard({ eyebrowText, titleText, bodyText, actionText, kind }) {
    action = kind;
    eyebrow.textContent = eyebrowText;
    title.textContent = titleText;
    body.textContent = bodyText;
    button.textContent = actionText;
    button.disabled = kind === "start" && !ready;
    delete button.dataset.state;
    status.hidden = kind !== "start" || ready;
    card.hidden = false;
    requestAnimationFrame(() => {
      card.dataset.open = "true";
      if (!button.disabled) button.focus({ preventScroll: true });
    });
  }

  function hideCard(delay) {
    setTimeout(() => {
      card.dataset.open = "false";
    }, delay);
  }

  ui.setPreparing = (fraction) => {
    ready = fraction >= 1;
    status.textContent = ready ? "" : `Preparing route · ${Math.round(fraction * 100)}%`;
    status.hidden = ready;
    if (action === "start") {
      button.disabled = !ready;
      if (ready && card.dataset.open === "true") button.focus({ preventScroll: true });
    }
  };

  ui.refreshStops = () => {
    stepper.innerHTML = "";
    stops.forEach((st, i) => {
      const li = document.createElement("li");
      li.dataset.state = st.state;
      li.innerHTML = '<span class="dot"></span><span class="name"></span><span class="km"></span>';
      li.querySelector(".name").textContent = st.name;
      li.querySelector(".km").textContent =
        i === 0 ? "origin" : `${Math.round(st.distance / 1000)} km`;
      stepper.appendChild(li);
    });
  };

  ui.showHandoff = (s) => {
    const i = s.leg + 1;
    showCard({
      kind: "verify",
      eyebrowText: `${CAM.handoffPromptMeters} m to stop ${i} of ${stops.length - 1}`,
      titleText: stops[i].name,
      bodyText: "Verify the handoff now to continue to the next stop.",
      actionText: "Verify handoff",
    });
  };

  ui.setPhase = (phase, s) => {
    root.dataset.phase = phase;
    const n = stops.length - 1;
    if (phase === "ready") {
      showCard({
        kind: "start",
        eyebrowText: `Shipment PT-0412 · N1 · ${routeKm} km`,
        titleText: "Cape Town → Beaufort West",
        bodyText: `${n} stops after Cape Town: Worcester and Beaufort West. Verify the handoff at each stop to continue.`,
        actionText: "Start journey",
      });
    } else if (phase === "city") {
      const i = s.leg + 1;
      const end = i === stops.length - 1;
      showCard({
        kind: "verify",
        eyebrowText: end ? `Stop ${i} of ${n} · Destination reached` : `Stop ${i} of ${n}`,
        titleText: stops[i].name,
        bodyText: end
          ? "Confirm the load arrived intact to close the shipment."
          : "Truck is rolling through. Verify the custody handoff to continue to the next stop.",
        actionText: end ? "Confirm delivery" : "Verify handoff",
      });
    } else if (phase === "done") {
      showCard({
        kind: "replay",
        eyebrowText: `Delivered · all ${n} stops verified`,
        titleText: "Cape Town → Beaufort West",
        bodyText: `${routeKm} km on the N1. Every handoff on this route was confirmed.`,
        actionText: "Replay",
      });
    }
  };

  ui.refreshStops();
  return ui;
}
