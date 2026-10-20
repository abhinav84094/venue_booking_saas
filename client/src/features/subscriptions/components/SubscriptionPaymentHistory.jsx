import { Button, Badge } from "../../../components/ui";
import { money } from "../../../utils/format";
export default function SubscriptionPaymentHistory({ payments, busy, reconcile }) {
  return (
    <section className="panel">
      <div className="section-title">
        <h2>Subscription payment history</h2>
        <span className="eyebrow">PLATFORM PAYMENTS ONLY</span>
      </div>
      {payments.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Plan / order</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p._id}>
                  <td>
                    <strong>{p.planSnapshot.name}</strong>
                    <small>{p.razorpayOrderId}</small>
                  </td>
                  <td>{money(p.amount)}</td>
                  <td>
                    <Badge>{p.status}</Badge>
                  </td>
                  <td>
                    {p.status === "created" && (
                      <Button
                        variant="secondary"
                        busy={busy}
                        onClick={() => reconcile(p.razorpayOrderId)}
                      >
                        Verify status
                      </Button>
                    )}
                    {p.status === "review_required" && (
                      <span className="muted small">Contact platform support</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No subscription payments yet.</p>
      )}
    </section>
  );
}
