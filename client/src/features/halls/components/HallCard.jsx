import { Layers3, Users, ArrowRight } from "lucide-react";
import { Badge, Button } from "../../../components/ui";
import { money } from "../../../utils/format";
export default function HallCard({ hall: h, owner, pricingOnly, onEdit }) {
  return (
    <article className="hall-card">
      <div className="hall-cover">
        {h.images[0] ? (
          <img src={h.images[0].url} alt={h.images[0].alt || h.name} />
        ) : (
          <div className="hall-placeholder">
            <Layers3 size={38} />
          </div>
        )}
        <Badge>{!h.active ? "inactive" : h.published ? "published" : "draft"}</Badge>
      </div>
      <div className="hall-body">
        <div className="section-title">
          <h2>{h.name}</h2>
          <span className="capacity">
            <Users size={15} />
            {h.capacity}
          </span>
        </div>
        <p className="muted hall-description">
          {h.description || "A space ready for its next chapter."}
        </p>
        <div className="facility-tags">
          {h.facilities.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
        <div className="hall-prices">
          {h.pricing.length ? (
            h.pricing.map((r) => (
              <div key={r.key}>
                <span>{r.label}</span>
                <strong>
                  {money(r.amount)}
                  {r.key === "HOURLY" && <small> / hour</small>}
                </strong>
              </div>
            ))
          ) : (
            <p className="muted">No rates configured yet.</p>
          )}
        </div>
        {owner && (
          <Button variant="secondary" className="full" onClick={() => onEdit(h)}>
            {pricingOnly ? "Edit pricing" : "Manage hall"}
            <ArrowRight size={16} />
          </Button>
        )}
      </div>
    </article>
  );
}
