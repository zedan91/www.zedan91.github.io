// AZOBSS PATCH 413 fallback entrypoint
// If Render start command is accidentally set to "node server.js",
// this bootstraps the real AZOBSS backend.
console.log("AZOBSS PATCH 413 fallback server.js -> loading deploy-server.js");
require("./deploy-server.js");
