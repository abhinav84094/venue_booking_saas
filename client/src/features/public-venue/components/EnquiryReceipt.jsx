import { Check } from "lucide-react";
import { Button, ErrorNotice } from "../../../components/ui";
import { money, dateTime } from "../../../utils/format";

export default function EnquiryReceipt({ result, error, busy, refreshReceipt, onReset }) {
  return (
    <div className="enquiry-success" role="status">
      <span>
        <Check size={30} />
      </span>
      <p className="eyebrow">THE CONVERSATION HAS BEGUN</p>
      <h3>
        {{
          CONFIRMED: "Your event is confirmed.",
          COMPLETED: "Your event is complete.",
          REJECTED: "Your enquiry was declined.",
          CANCELLED: "Your booking was cancelled.",
          EXPIRED: "Your enquiry has expired.",
        }[result.status] || "Your enquiry is with us."}
      </h3>
      <p>
        Current status: <strong>{result.status.toLowerCase()}</strong>
      </p>
      <ErrorNotice error={error} />
      <p>
        Keep this reference: <strong>{result.reference}</strong>
      </p>
      <p>
        {dateTime(result.startAt, result.timezone)}
        <br />
        to {dateTime(result.endAt, result.timezone)}
      </p>
      <strong className="success-quote">{money(result.pricingSnapshot.totalAmount)}</strong>
      <p>
        {result.status === "CONFIRMED"
          ? "The venue has confirmed the hall and time shown above. Contact the venue directly for arrival and payment arrangements."
          : "The venue will contact you about your event."}{" "}
        Enquiry validity: {dateTime(result.enquiryExpiresAt, result.timezone)}.
      </p>
      <p>
        Keep this receipt open to check confirmation updates without creating an account. Receipt
        access lasts until 30 days after the event.
      </p>
      <Button variant="primary" busy={busy} onClick={refreshReceipt}>
        Refresh confirmation status
      </Button>
      <Button variant="secondary" onClick={onReset}>
        Make another enquiry
      </Button>
    </div>
  );
}
