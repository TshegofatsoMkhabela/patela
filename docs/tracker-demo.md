# Route tracker demo

The `/tracker` page replays a simulated N1 shipment from Cape Town through Worcester to Beaufort West. It does not show live truck GPS data or record a real custody handoff.

Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to a browser key restricted to the site's origin with the Maps JavaScript API enabled. `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` defaults to `DEMO_MAP_ID`; use a vector map ID for the 3D view. Restart or redeploy the frontend after changing either variable.

The truck uses a recolored version of [“Low Poly Truck”](https://sketchfab.com/3d-models/low-poly-truck-98826ebd44e2492298ac925461509216) by Arifido._ under CC BY 4.0. The full model license is in `tracker-demo/public/models/license.txt`. Road geometry is from OpenStreetMap via OSRM.
