import { Button, Badge } from "../../../components/ui";
export default function AdminRecordsTable({ tab, items = [], busy, suspend }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {(tab === "users"
              ? ["Account", "Role", "Status", "Access"]
              : tab === "venues"
                ? ["Venue", "Owner", "Website", "Status"]
                : tab === "subscriptions"
                  ? ["Venue", "Plan", "Status", "Period ends"]
                  : ["Action", "Venue", "Resource", "Recorded"]
            ).map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r._id}>
              {tab === "users" ? (
                <>
                  <td>
                    <strong>{r.name}</strong>
                    <small>{r.email}</small>
                  </td>
                  <td>{r.role}</td>
                  <td>
                    <Badge>
                      {r.suspended ? "suspended" : r.emailVerified ? "active" : "unverified"}
                    </Badge>
                  </td>
                  <td>
                    {r.role !== "platform_admin" && (
                      <Button variant="secondary" busy={busy} onClick={() => suspend(r)}>
                        {r.suspended ? "Reactivate" : "Suspend"}
                      </Button>
                    )}
                  </td>
                </>
              ) : tab === "venues" ? (
                <>
                  <td>
                    <strong>{r.name}</strong>
                    <small>{r.slug}</small>
                  </td>
                  <td>{r.ownerId?.email}</td>
                  <td>
                    <Badge>{r.published ? "published" : "draft"}</Badge>
                  </td>
                  <td>
                    <Badge>{r.suspended ? "suspended" : "active"}</Badge>
                  </td>
                </>
              ) : tab === "subscriptions" ? (
                <>
                  <td>{r.venueId?.name}</td>
                  <td>{r.planSnapshot?.name || "—"}</td>
                  <td>
                    <Badge>{r.status}</Badge>
                  </td>
                  <td>
                    {r.currentPeriodEnd
                      ? new Date(r.currentPeriodEnd).toLocaleDateString("en-IN")
                      : "—"}
                  </td>
                </>
              ) : (
                <>
                  <td>{r.action}</td>
                  <td>{r.venueId || "Platform"}</td>
                  <td>{r.resourceId}</td>
                  <td>{new Date(r.at).toLocaleString("en-IN")}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
