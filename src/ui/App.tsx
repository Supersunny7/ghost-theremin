// Root application shell.
// During the latency spike this mounts LatencySpike directly.
// It will be replaced with the full UI once the engine/audio/vision layers
// are built.
import { LatencySpike } from "./LatencySpike.tsx";

export function App() {
  return <LatencySpike />;
}
