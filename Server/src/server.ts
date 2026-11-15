
import app from "./app";
// Hosts like Render pick the port and pass it in PORT.
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Single-service hosting (e.g. Render's free plan): run the order worker in this process.
// Locally it runs separately with `npm run dev:worker`, so this stays off by default.
if (process.env.RUN_WORKER === "true") {
  void import("./workers/order-reminder.worker.js");
}
