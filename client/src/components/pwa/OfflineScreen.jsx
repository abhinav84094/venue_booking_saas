import { WifiOff } from "lucide-react";
import { Brand, Button } from "../ui";
import { usePwaState } from "../../pwa/usePwaState";

export default function OfflineScreen() {
  const { online } = usePwaState();
  return (
    <main className="pwa-connection-screen">
      <Brand />
      <section className="panel">
        <WifiOff size={32} aria-hidden="true" />
        <p className="eyebrow">PRAKASH VENUE</p>
        <h1>An internet connection is required.</h1>
        <p>
          Connect to the internet to manage your venues, check live availability, confirm bookings
          or make payments. No booking or payment has been completed offline.
        </p>
        <p className="muted" role="status">
          {online
            ? "Your connection is back. Retry to securely check your session and hall access."
            : "Your device is offline. Reconnect, then try again."}
        </p>
        <Button onClick={() => window.location.reload()}>Retry connection</Button>
      </section>
    </main>
  );
}
