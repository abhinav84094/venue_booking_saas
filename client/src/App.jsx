import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/authContext";
import ProtectedRoute from "./components/shared/ProtectedRoute";
import { Loading, Notice } from "./components/ui";
import { getVenueSlugFromHostname } from "./utils/venueDomain";
import RouteAppearance from "./theme/RouteAppearance";
const Landing = lazy(() => import("./pages/LandingPage"));
const Auth = lazy(() => import("./pages/AuthPage"));
const Venues = lazy(() => import("./pages/VenuesPage"));
const Profile = lazy(() => import("./pages/VenueProfilePage"));
const Layout = lazy(() => import("./components/dashboard/VenueLayout"));
const Overview = lazy(() => import("./pages/OverviewPage"));
const Halls = lazy(() => import("./pages/HallsPage"));
const Availability = lazy(() => import("./pages/AvailabilityPage"));
const Bookings = lazy(() => import("./pages/BookingsPage"));
const Customers = lazy(() => import("./pages/CustomersPage"));
const Payments = lazy(() => import("./pages/PaymentsPage"));
const Website = lazy(() => import("./pages/WebsitePage"));
const Subscription = lazy(() => import("./pages/SubscriptionPage"));
const Settings = lazy(() => import("./pages/SettingsPage"));
const PublicVenue = lazy(() => import("./pages/PublicVenuePage"));
const Admin = lazy(() => import("./pages/AdminPage"));
const Onboarding = lazy(() => import("./components/dashboard/OnboardingLayout"));
const SubscriptionLayout = lazy(() => import("./components/dashboard/SubscriptionLayout"));
const HallSelection = lazy(() => import("./pages/HallSelectionPage"));
const Account = lazy(() => import("./pages/AccountPage"));
function Guest({ children }) {
  const { loading, user } = useAuth();
  if (loading) return <Loading text="Checking your session?" />;
  return user ? (
    <Navigate to={user.role === "platform_admin" ? "/admin" : "/venues"} replace />
  ) : (
    children
  );
}
export default function App() {
  const subdomain = getVenueSlugFromHostname();
  return (
    <BrowserRouter>
      <RouteAppearance />
      <Suspense fallback={<Loading />}>
        {subdomain ? (
          <Routes>
            <Route path="*" element={<PublicVenue />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<Landing />} />
            {[
              ["login", "login"],
              ["register", "register"],
              ["forgot-password", "forgot"],
            ].map(([path, mode]) => (
              <Route
                key={path}
                path={`/${path}`}
                element={
                  <Guest>
                    <Auth key={mode} mode={mode} />
                  </Guest>
                }
              />
            ))}
            <Route path="/google/set-password" element={<Auth key="google" mode="google" />} />
            <Route path="/v/:slug" element={<PublicVenue />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/venues" element={<Venues />} />
              <Route path="/account" element={<Account />} />
              <Route path="/venues/new" element={<Profile create />} />
              <Route path="/venues/:venueId" element={<Onboarding />}>
                <Route index element={<Navigate to="halls" replace />} />
                <Route path="setup" element={<Profile />} />
                <Route path="halls" element={<HallSelection />} />
                <Route path="*" element={<Navigate to="../halls" replace />} />
              </Route>
              <Route
                path="/venues/:venueId/halls/:hallId/subscription"
                element={<SubscriptionLayout />}
              >
                <Route index element={<Subscription />} />
              </Route>
              <Route path="/venues/:venueId/halls/:hallId" element={<Layout />}>
                <Route index element={<Overview />} />
                <Route path="profile" element={<Profile />} />
                <Route path="halls" element={<Halls />} />
                <Route path="pricing" element={<Halls pricingOnly />} />
                <Route path="availability" element={<Availability />} />
                <Route path="enquiries" element={<Bookings key="all" />} />
                <Route path="bookings" element={<Bookings key="confirmed" confirmed />} />
                <Route path="customers" element={<Customers />} />
                <Route path="payments" element={<Payments />} />
                <Route path="website" element={<Website />} />
                <Route path="settings" element={<Settings />} />
                <Route
                  path="no-access"
                  element={
                    <Notice type="info">
                      No workspace sections are enabled for your membership. Ask the venue owner to
                      grant the permissions you need.
                    </Notice>
                  }
                />
              </Route>
              <Route path="/admin" element={<Admin />} />
            </Route>
            <Route
              path="*"
              element={
                <main className="standalone">
                  <p className="eyebrow">A LITTLE OFF THE MAP</p>
                  <h1>This space is still waiting to be found.</h1>
                  <a className="btn btn-primary" href="/">
                    Return home
                  </a>
                </main>
              }
            />
          </Routes>
        )}
      </Suspense>
    </BrowserRouter>
  );
}
