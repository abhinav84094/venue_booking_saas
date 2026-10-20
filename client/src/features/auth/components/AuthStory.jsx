import { Check } from "lucide-react";
import { Brand } from "../../../components/ui";
export default function AuthStory() {
  return (
    <aside className="auth-story">
      <Brand light />
      <div>
        <span className="eyebrow light">MADE FOR MOMENTS THAT MATTER</span>
        <h2>
          Beautiful spaces.
          <br />
          <i>Seamless beginnings.</i>
        </h2>
        <p>
          Less administration. More celebration. A considered workspace for the people behind
          extraordinary venues.
        </p>
        <div className="auth-benefits">
          {[
            "A website that feels like your venue",
            "Every hall. Every date. One place.",
            "Your business, always in your hands",
          ].map((t) => (
            <span key={t}>
              <Check size={17} />
              {t}
            </span>
          ))}
        </div>
      </div>
      <span className="auth-footer">Prakash SaaS · Thoughtfully built for venue owners</span>
    </aside>
  );
}
