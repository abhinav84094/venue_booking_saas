import AdminRecordsTable from "../features/admin/components/AdminRecordsTable";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import api from "../services/api";
import { useResource } from "../hooks/useResource";
import { useAuth } from "../context/authContext";
import { Brand, PageHeading, Button, ErrorNotice, Loading, Badge } from "../components/ui";
import { money } from "../utils/format";
export default function AdminPage() {
  const { user } = useAuth(),
    [tab, setTab] = useState("users"),
    [page, setPage] = useState(1),
    overview = useResource("/admin/overview"),
    resource = useResource(`/admin/${tab}?page=${page}`),
    plans = useResource("/admin/plans");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  if (user.role !== "platform_admin")
    return (
      <main className="standalone">
        <h1>Administrator access required.</h1>
        <Link to="/venues">Return to your workspace</Link>
      </main>
    );
  async function suspend(u) {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/admin/users/${u._id}/suspension`, { suspended: !u.suspended });
      resource.reload();
      overview.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-page">
      <header className="workspace-header">
        <Brand />
        <Link className="btn btn-secondary" to="/venues">
          Your venues
        </Link>
      </header>
      <main className="admin-main">
        <PageHeading
          eyebrow="PLATFORM ADMINISTRATION"
          title="The bigger picture."
          action={
            <span className="admin-label">
              <ShieldCheck size={18} />
              Platform administrator
            </span>
          }
        >
          Manage owners, venues and platform access. View subscription prices configured by the
          platform operator.
        </PageHeading>
        <ErrorNotice error={error || resource.error || overview.error || plans.error} />
        {overview.data && (
          <div className="stat-grid">
            {Object.entries(overview.data.stats).map(([k, v]) => (
              <div className="stat-card" key={k}>
                <span>{k.replace(/([A-Z])/g, " $1")}</span>
                <strong>{k === "subscriptionRevenue" ? money(v) : v}</strong>
              </div>
            ))}
          </div>
        )}
        <nav className="tabs" aria-label="Administration sections">
          {["users", "venues", "subscriptions", "plans", "audit"].map((t) => (
            <button
              className={tab === t ? "active" : ""}
              key={t}
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
            >
              {t}
            </button>
          ))}
        </nav>
        {tab === "plans" ? (
          <>
            <section className="panel">
              <h2>Subscription pricing</h2>
              <p>
                Prices come from the server environment: VENUE_PLAN_3_MONTHS_PRICE and
                VENUE_PLAN_1_YEAR_PRICE, in rupees. Update them and restart the server to change
                prices for new purchases. Existing purchases retain their verified price and
                validity.
              </p>
            </section>
            <div className="plan-grid">
              {plans.data?.plans.map((p) => (
                <article className="plan-card" key={p._id}>
                  <h2>{p.name}</h2>
                  <p>
                    {money(p.amount)} / {p.interval === "quarterly" ? "3 months" : "1 year"}
                  </p>
                  <Badge>{p.active ? "active" : "inactive"}</Badge>
                </article>
              ))}
            </div>
          </>
        ) : resource.loading ? (
          <Loading />
        ) : (
          <section className="panel">
            <AdminRecordsTable
              tab={tab}
              items={resource.data?.items}
              busy={busy}
              suspend={suspend}
            />
            {!resource.data?.items.length && <p className="muted">No records to display.</p>}
            <div className="pagination">
              <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span>
                Page {page} · {resource.data?.total || 0} records
              </span>
              <Button
                variant="secondary"
                disabled={page * 25 >= (resource.data?.total || 0)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
