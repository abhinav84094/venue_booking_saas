import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Layers3,
  IndianRupee,
  CalendarDays,
  Inbox,
  CalendarCheck2,
  Users,
  Wallet,
  Globe2,
  Settings,
  ArrowUpRight,
  ArrowLeft,
  Menu,
  X,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../context/authContext";
import { useResource } from "../../hooks/useResource";
import { getVenuePublicUrl } from "../../utils/venueDomain";
import { Loading, ErrorNotice, Button, Badge } from "../ui";
const navigation = [
  ["", "Overview", LayoutDashboard, "overview:read"],
  ["profile", "Venue profile", Building2, "owner"],
  ["halls", "Hall management", Layers3, "halls:read"],
  ["pricing", "Hall pricing", IndianRupee, "owner"],
  ["availability", "Availability", CalendarDays, "bookings:read"],
  ["enquiries", "Booking requests", Inbox, "bookings:read"],
  ["bookings", "Confirmed bookings", CalendarCheck2, "bookings:read"],
  ["customers", "Customers", Users, "customers:read"],
  ["payments", "Payment records", Wallet, "payments:read"],
  ["website", "Your website", Globe2, "owner"],
  ["subscription", "Subscription", ShieldCheck, "owner"],
  ["settings", "Account & team", Settings, "owner"],
];
export default function VenueLayout() {
  const { venueId, hallId } = useParams(),
    { user, logout } = useAuth(),
    navigate = useNavigate(),
    location = useLocation(),
    [open, setOpen] = useState(false),
    [logoutError, setLogoutError] = useState(null);
  const base = `/venues/${venueId}/halls/${hallId}`;
  const resource = useResource(`${base}/access?navigation=${encodeURIComponent(location.key)}`),
    { data, loading, error, reload } = resource;
  useEffect(() => {
    if (!data?.venue?.name) return;
    const previous = document.title;
    document.title = `${data.venue.name} | Dashboard`;
    return () => {
      document.title = previous;
    };
  }, [data?.venue?.name]);
  useEffect(() => {
    const onDenied = (event) => {
      if (event.detail?.url === base || event.detail?.url?.startsWith(`${base}/`))
        navigate(`${base}/subscription`, { replace: true });
    };
    const onFocus = () => reload();
    window.addEventListener("venue:subscription-required", onDenied);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("venue:subscription-required", onDenied);
      window.removeEventListener("focus", onFocus);
    };
  }, [base, navigate, reload]);
  useEffect(() => {
    if (!data?.dashboardAccess || !data.subscription?.currentPeriodEnd) return;
    const remaining = new Date(data.subscription.currentPeriodEnd).getTime() - Date.now();
    if (!Number.isFinite(remaining)) return;
    const timer = setTimeout(reload, Math.max(0, Math.min(remaining, 86400000)));
    return () => clearTimeout(timer);
  }, [data, reload]);
  if (loading) return <Loading />;
  if (error)
    return (
      <main className="standalone">
        <ErrorNotice error={error} />
        <Link to="/venues">← Back to your venues</Link>
        <Button onClick={resource.reload}>Try again</Button>
      </main>
    );
  if (!data) return null;
  const { venue, access, hall, subscription } = data,
    owner = access.role === "owner",
    can = (permission) => owner || access.permissions.includes(permission),
    venueBase = `/venues/${venueId}`;
  if (!data.dashboardAccess)
    return <Navigate to={owner ? `${base}/subscription` : "/venues"} replace />;
  return (
    <div className="dashboard">
      {open && (
        <button
          className="sidebar-scrim visible"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside id="venue-navigation" className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <Link
            to={`${venueBase}/halls`}
            className="dashboard-brand"
            aria-label={`${venue.name} hall selection`}
          >
            <span className="venue-initial">{venue.name.slice(0, 1)}</span>
            <span className="dashboard-brand-copy">
              <strong>{venue.name}</strong>
              <span>Venue dashboard</span>
            </span>
          </Link>
          <button
            className="icon-btn mobile-only"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={19} />
          </button>
        </div>
        <Link to="/venues" className="venue-switch">
          <span className="venue-initial">{hall.name.slice(0, 1)}</span>
          <div>
            <strong>{hall.name}</strong>
            <span>
              Switch hall <ArrowLeft size={11} />
            </span>
          </div>
        </Link>
        <span className="sidebar-section">YOUR WORKSPACE</span>
        <nav aria-label="Venue workspace">
          {navigation
            .filter(([, , , permission]) => can(permission))
            .map(([path, label, Icon]) => (
              <NavLink end={!path} to={`${base}/${path}`} key={path} onClick={() => setOpen(false)}>
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <p className="sidebar-subscription">
            <strong>{subscription?.planSnapshot?.name}</strong>
            <span>{subscription?.remainingDays ?? 0} days remaining</span>
            {owner && <Link to={`${base}/subscription`}>View validity & renewal</Link>}
          </p>
          <a href={getVenuePublicUrl(venue.slug)} target="_blank" rel="noreferrer">
            <Globe2 size={18} />
            Visit your website
            <ArrowUpRight size={15} />
          </a>
          <span>
            A little less work.
            <br />
            <i>A lot more possibility.</i>
          </span>
        </div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <button
              className="icon-btn mobile-only"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="venue-navigation"
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              Dashboard <span>/</span>
              <strong>
                {venue.name} · {hall.name}
              </strong>
            </span>
          </div>
          <div>
            <Badge>{subscription.status}</Badge>
            <span className="user-avatar" title={user.name}>
              {user.name.slice(0, 1)}
            </span>
            <button
              className="icon-btn"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  await logout();
                  navigate("/login");
                } catch (e) {
                  setLogoutError(e);
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="dashboard-content">
          <ErrorNotice error={logoutError} />
          {/* <details className="dashboard-validity" open>
            <summary>
              Hall subscription · {subscription?.planSnapshot?.name} ·{" "}
              {subscription?.remainingDays ?? 0} days remaining
            </summary>
            <SubscriptionValidity subscription={subscription} timezone={venue.timezone} compact />
            <p className="muted small">
              Times use {venue.timezone}. Access ends at the displayed expiration time.{" "}
              {owner && <Link to={`${base}/subscription`}>View renewal options</Link>}
            </p>
          </details> */}
          <Outlet
            context={{
              venue,
              hall,
              subscription,
              access,
              owner,
              can,
              base,
              venueBase,
              reloadVenue: resource.reload,
            }}
          />
        </main>
        {/* <footer className="dashboard-footer">
          <span>Prakash SaaS · Venue Booking</span>
          <span>Made for the moments ahead.</span>
        </footer> */}
      </div>
    </div>
  );
}
