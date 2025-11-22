import { Background } from "@/components/background";
import { Newsletter } from "@/components/newsletter";

export default function Home() {
  return (
    <main className="h-[100dvh] w-full overflow-hidden">
      <div className="relative h-full w-full">
        <Background src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/alt-g7Cv2QzqL3k6ey3igjNYkM32d8Fld7.mp4" placeholder="/alt-placeholder.png" />
        <Newsletter />
      </div>
    </main>
  );
}
