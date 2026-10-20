import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, Wallet } from "lucide-react";
import { useResource } from "../hooks/useResource";
import PaymentRecordForm from "../features/payments/components/PaymentRecordForm";
import { usePaymentRecords } from "../features/payments/hooks/usePaymentRecords";
import { PageHeading, Loading, ErrorNotice, Notice, Empty, Button, Badge } from "../components/ui";
import { money } from "../utils/format";
export default function PaymentsPage() {
  const { base, can } = useOutletContext(),
    [page, setPage] = useState(1),
    resource = useResource(`${base}/payments?page=${page}`),
    bookings = useResource(can("payments:write") ? `${base}/bookings?limit=100` : null);
  const {
    open,
    setOpen,
    form,
    setForm,
    busy,
    error,
    message,
    bookingReference,
    setBookingReference,
    availableBookings,
    selected,
    findBooking,
    save,
  } = usePaymentRecords(base, resource, bookings);
  return (
    <>
      <PageHeading
        eyebrow="A CLEAR RECORD OF EVERY RUPEE"
        title="Payments, thoughtfully recorded."
        action={
          can("payments:write") && (
            <Button onClick={() => setOpen(!open)}>
              <Plus size={17} />
              Record payment
            </Button>
          )
        }
      >
        Direct venue receipts and refunds. Your SaaS subscription has its own separate ledger.
      </PageHeading>
      <Notice type="info">
        Manual payment arrangement · Record payments already received or refunded through your
        venue’s own cash, UPI or bank account. This page does not collect or transfer funds.
      </Notice>
      <ErrorNotice error={error || resource.error || bookings.error} />
      <Notice type="success">{message}</Notice>
      {open && (
        <PaymentRecordForm
          onClose={() => setOpen(false)}
          save={save}
          bookingReference={bookingReference}
          setBookingReference={setBookingReference}
          busy={busy}
          findBooking={findBooking}
          availableBookings={availableBookings}
          form={form}
          setForm={setForm}
          selected={selected}
        />
      )}
      {resource.loading ? (
        <Loading />
      ) : resource.data?.items.length ? (
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Booking / reference</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Recorded</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.items.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <strong>{p.bookingId?.reference || "Booking"}</strong>
                      <small>{p.reference}</small>
                    </td>
                    <td>
                      <Badge>{p.type}</Badge>
                    </td>
                    <td className={p.type === "REFUND" ? "error-text" : ""}>
                      {p.type === "REFUND" ? "−" : "+"}
                      {money(p.amount)}
                    </td>
                    <td>{p.method.replaceAll("_", " ")}</td>
                    <td>{new Date(p.createdAt).toLocaleDateString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <Button variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span>
              {resource.data.total} records · Page {page}
            </span>
            <Button
              variant="secondary"
              disabled={page * 25 >= resource.data.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </section>
      ) : (
        !resource.error && (
          <Empty icon={Wallet} title="Ready for your first receipt.">
            Record advances, balances and refunds after your first confirmed booking.
          </Empty>
        )
      )}
    </>
  );
}
