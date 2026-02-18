import HomePage from "./routes/HomePage";
import NotFoundPage from "./routes/NotFoundPage";
import MonaLisaPage from "./routes/mona-lisa/MonaLisaPage";
import PerspectiveCameraPage from "./routes/perspective-camera/PerspectiveCameraPage";
import VisualComputeShaderPage from "./routes/visual-compute-shader/VisualComputeShaderPage";
import ComputePage from "./routes/compute/ComputePage";
import { usePathname } from "./navigation";

export default function App() {
  const pathname = usePathname();

  if (pathname === "/") return <HomePage />;
  if (pathname === "/mona-lisa") return <MonaLisaPage />;
  if (pathname === "/perspective-camera") return <PerspectiveCameraPage />;
  if (pathname === "/visual-compute-shader") return <VisualComputeShaderPage />;
  if (pathname === "/compute") return <ComputePage />;
  return <NotFoundPage pathname={pathname} />;
}
