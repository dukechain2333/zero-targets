import { About } from "@/components/about";
import { ZeroApp } from "@/components/zero-app";

export default function Home() {
  return <ZeroApp about={<About />} />;
}
