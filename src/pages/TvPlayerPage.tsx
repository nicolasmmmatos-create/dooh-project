import { useParams } from "react-router-dom";
import TvPlayer from "@/components/TvPlayer";
import { useEffect } from "react";

export default function TvPlayerPage() {
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    // Viewport meta for TV/kiosk — prevent zoom and bars
    let meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover"
      );
    }

    // Inject global TV styles
    const style = document.createElement("style");
    style.id = "tv-player-global";
    style.innerHTML = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: 100vw; height: 100vh;
        overflow: hidden; background: black;
      }
    `;
    document.head.appendChild(style);

    return () => {
      const el = document.getElementById("tv-player-global");
      if (el) el.remove();
    };
  }, []);

  if (!token) {
    return <div className="w-screen h-screen bg-black" />;
  }

  return <TvPlayer token={token} />;
}
