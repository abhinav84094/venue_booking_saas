import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Building2,
  Globe2,
  Check,
  MoveUpRight,
  Phone,
  Mail,
} from "lucide-react";
import { Brand } from "../components/ui";
import { useAuth } from "../context/authContext";
import { platformCopy } from "../../../shared/platformSeo.js";
export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const supportPhone = import.meta.env.VITE_CONTACT_PHONE?.trim();
  const supportEmail = import.meta.env.VITE_CONTACT_EMAIL?.trim();
  const hasSupportContact = Boolean(supportPhone || supportEmail);
  return (
    <div className="landing">
      <header className="landing-header">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#experience">The experience</a>
          <a href="#workspace">Your workspace</a>
          {hasSupportContact && <a href="#support">Contact support</a>}
          <Link to={isAuthenticated ? "/venues" : "/login"}>
            Sign in <ArrowUpRight size={14} />
          </Link>
        </nav>
        <Link className="btn btn-primary" to={isAuthenticated ? "/venues" : "/register"}>
          {isAuthenticated ? "Open workspace" : "Create your venue"}
          <ArrowRight size={16} />
        </Link>
      </header>
      <main>
        <section className="landing-hero" aria-labelledby="platform-heading">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span />A BETTER HOME FOR YOUR VENUE
            </div>
            <h1 id="platform-heading">
              {platformCopy.heroLines[0]}
              <br />
              {platformCopy.heroLines[1]}
              <br />
              <i>{platformCopy.heroLines[2]}</i>
            </h1>
            <p>{platformCopy.introduction}</p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-large" to="/register">
                Bring your venue online <ArrowUpRight size={19} />
              </Link>
              <a href="#experience" className="hero-secondary">
                Take a closer look <ArrowRight size={16} />
              </a>
            </div>
            <div className="hero-note">
              <span className="mini-icon">
                <Check size={14} />
              </span>
              Built for independent venues. No coding needed.
            </div>
            {hasSupportContact && (
              <p className="hero-support">
                Need help getting started? <a href="#support">Contact support</a>
              </p>
            )}
          </div>
          <div
            className="hero-art"
            aria-label="Architectural illustration of an elegant event venue"
          >
            <span className="art-label">A SPACE FOR EVERY OCCASION</span>
            <div className="art-sun" />
            <div className="art-building">
              <div className="building-roof" />
              <div className="building-line" />
              <div className="building-arches">
                {[0, 1, 2].map((n) => (
                  <div className="building-arch" key={n}>
                    <div />
                  </div>
                ))}
              </div>
              <div className="building-steps" />
            </div>
            <div className="art-tree tree-left" />
            <div className="art-tree tree-right" />
            <div className="art-caption">
              <span>YOUR VENUE, BEAUTIFULLY PRESENTED</span>
              <span>
                Est. for unforgettable events <MoveUpRight size={16} />
              </span>
            </div>
            <div className="floating-note">
              <span className="floating-icon">
                <CalendarDays size={19} />
              </span>
              <div>
                <strong>Make space for possibility.</strong>
                <span>Every hall. Every event. In harmony.</span>
              </div>
            </div>
            <span className="art-orbit">PRAKASH · VENUE BOOKING</span>
          </div>
        </section>
        <div className="venue-types">
          <span>BUILT AROUND YOUR SPACE</span>
          <p>
            Banquet halls <span>✦</span> Wedding venues <span>✦</span> Resorts <span>✦</span>{" "}
            Conference spaces
          </p>
        </div>
        <section
          className="experience-section"
          id="experience"
          aria-labelledby="experience-heading"
        >
          <div className="section-heading">
            <p className="eyebrow">FROM FIRST IMPRESSION TO FINAL CELEBRATION</p>
            <h2 id="experience-heading">
              One beautiful place.
              <br />
              <i>For everything behind the event.</i>
            </h2>
          </div>
          <div className="feature-grid">
            {platformCopy.features.map(({ n, title, text, foot }, index) => {
              const Icon = [Globe2, Building2, CalendarDays][index];
              return (
                <article className="feature-card" key={n}>
                  <div>
                    <Icon size={25} />
                    <span>{n}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <span className="feature-foot">
                    {foot}
                    <ArrowUpRight size={17} />
                  </span>
                </article>
              );
            })}
          </div>
        </section>
        <section className="workspace-section" id="workspace" aria-labelledby="workspace-heading">
          <div>
            <p className="eyebrow">THE QUIET SIDE OF GREAT EVENTS</p>
            <h2 id="workspace-heading">
              More celebration.
              <br />
              <i>Less administration.</i>
            </h2>
            <p>
              Bring your venues, customers, enquiries and recorded payments together. A clear view
              of your business, with the details close at hand.
            </p>
            <Link className="btn btn-primary" to="/register">
              Step into your workspace <ArrowRight size={17} />
            </Link>
          </div>
          <div className="workspace-list">
            {platformCopy.workspace.map((t, i) => (
              <div key={t}>
                <span>0{i + 1}</span>
                <h3>{t}</h3>
                <Check size={17} />
              </div>
            ))}
          </div>
        </section>
        {hasSupportContact && (
          <section className="landing-support" id="support" aria-labelledby="support-heading">
            <div>
              <p className="eyebrow">WE'RE HERE TO HELP</p>
              <h2 id="support-heading">A little help getting started.</h2>
              <p>
                Stuck setting up your venue? Contact us for help with your account, venue details,
                halls or subscriptions.
              </p>
            </div>
            <div className="landing-support-contact">
              {supportPhone && (
                <a
                  className="btn btn-primary"
                  href={`tel:${supportPhone.replace(/[^+\d]/g, "")}`}
                  aria-label={`Call support at ${supportPhone}`}
                >
                  <Phone size={18} aria-hidden="true" />
                  {supportPhone}
                </a>
              )}
              {supportEmail && (
                <a className="support-email" href={`mailto:${supportEmail}`}>
                  <Mail size={18} aria-hidden="true" />
                  <span>{supportEmail}</span>
                </a>
              )}
            </div>
          </section>
        )}
        <section className="landing-cta" aria-labelledby="start-heading">
          <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
          <h2 id="start-heading">
            Great moments
            <br />
            need <i>great spaces.</i>
          </h2>
          <Link className="btn btn-cream btn-large" to="/register">
            Let’s make room <ArrowUpRight size={18} />
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>© {new Date().getFullYear()} Prakash SaaS. Made for meaningful gatherings.</span>
        <nav aria-label="Footer navigation">
          {hasSupportContact && <a href="#support">Contact support</a>}
          <Link to="/login">
            Owner sign in <ArrowUpRight size={14} />
          </Link>
        </nav>
      </footer>
    </div>
  );
}
