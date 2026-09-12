import HomePage from "./(viewer)/page";
import { ViewerShell } from "@/components/layout/viewer-shell";

export default function RootPage() {
  return <ViewerShell><HomePage /></ViewerShell>;
}
