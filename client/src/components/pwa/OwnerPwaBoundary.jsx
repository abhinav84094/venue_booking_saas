import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { isOwnerAppLocation } from "../../pwa/policy";
import { syncOwnerPwaLocation } from "../../pwa/runtime";
import { usePwaState } from "../../pwa/usePwaState";
import OfflineScreen from "./OfflineScreen";
import PwaUpdateNotice from "./PwaUpdateNotice";
import PwaErrorBoundary from "./PwaErrorBoundary";

export default function OwnerPwaBoundary({ children }) {
  const { pathname } = useLocation();
  const { reconnectRequired } = usePwaState();
  const owner = isOwnerAppLocation({
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    port: window.location.port,
    pathname,
  });
  useEffect(() => {
    syncOwnerPwaLocation();
  }, [pathname]);
  if (!owner) return children;
  if (reconnectRequired) return <OfflineScreen />;
  return (
    <>
      <PwaErrorBoundary>{children}</PwaErrorBoundary>
      <PwaUpdateNotice />
    </>
  );
}
