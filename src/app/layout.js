import "./globals.css";

// App chrome
import Navbar from "@/app/components/Navbar";

// Global player (Option B: keep playing while browsing)
import { PlayerProvider } from "@/app/components/player/PlayerProvider";
import StickyPlayerBar from "@/app/components/player/StickyPlayerBar";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <PlayerProvider>
          <Navbar />
          {children}
          <StickyPlayerBar />
        </PlayerProvider>
      </body>
    </html>
  );
}