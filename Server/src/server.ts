
import app from "./app";
// Hosts like Render pick the port and pass it in PORT.
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
