import HomePage from "./routes/HomePage";
import NotFoundPage from "./routes/NotFoundPage";
import VisualComputeShaderPage from "./routes/visual-compute-shader/VisualComputeShaderPage";
import { usePathname } from "./routing";

export default function App() {
  const pathname = usePathname();

  if (pathname === "/") return <HomePage />;
  if (pathname === "/visual-compute-shader") return <VisualComputeShaderPage />;
  return <NotFoundPage pathname={pathname} />;
}
