# Standalone route tracker source

`npm install` followed by `npm run build` rebuilds the static page in `public/tracker-demo`. The Patela `/tracker` page mounts that output directly. The build reads its Google Maps browser key from `/api/tracker-config` at runtime, so no key is stored in the bundle.

The route data is a simulated Cape Town → Worcester → Beaufort West N1 journey. The truck model and its attribution are in `public/models`.
