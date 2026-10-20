import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";

export function Brand({ light = false }) {
  return (
    <Link to="/" className={`brand ${light ? "brand-light" : ""}`} aria-label="Prakash SaaS home">
      <span className="brand-mark">
        <Building2 size={22} />
      </span>
      <span>
        Prakash SaaS<span className="brand-sub">VENUE BOOKING</span>
      </span>
    </Link>
  );
}
