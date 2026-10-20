import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Building2,
  Globe2,
  Check,
  MoveUpRight,
} from "lucide-react";
import { Brand } from "../components/ui";
import { useAuth } from "../context/authContext";
export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  return (
    <div className="landing">
      <header className="landing-header">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#experience">The experience</a>
          <a href="#workspace">Your workspace</a>
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
        <section className="landing-hero">
          <div className="hero-copy">
            <div className="hero-kicker">
              <span />A BETTER HOME FOR YOUR VENUE
            </div>
            <h1>
              You create
              <br />
              the moments.
              <br />
              <i>We make room.</i>
            </h1>
            <p>
              A beautiful website. An organized calendar. A calmer way to run your venue business —
              all in one thoughtful workspace.
            </p>
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
        <section className="experience-section" id="experience">
          <div className="section-heading">
            <p className="eyebrow">FROM FIRST IMPRESSION TO FINAL CELEBRATION</p>
            <h2>
              One beautiful place.
              <br />
              <i>For everything behind the event.</i>
            </h2>
          </div>
          <div className="feature-grid">
            {[
              {
                n: "01",
                icon: Globe2,
                title: "A website with presence.",
                text: "Give your venue its own address, showcase your halls, share your story and let customers find their perfect setting.",
                foot: "Your space, your identity",
              },
              {
                n: "02",
                icon: Building2,
                title: "Every hall, considered.",
                text: "Set capacity, amenities and pricing for each space. Choose hourly, half-day, full-day or your own packages.",
                foot: "Flexible by design",
              },
              {
                n: "03",
                icon: CalendarDays,
                title: "A calendar with clarity.",
                text: "Review enquiries, confirm events and block maintenance. Conflicting confirmations are prevented at the source.",
                foot: "Room for confidence",
              },
            ].map(({ n, icon: Icon, title, text, foot }) => (
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
            ))}
          </div>
        </section>
        <section className="workspace-section" id="workspace">
          <div>
            <p className="eyebrow">THE QUIET SIDE OF GREAT EVENTS</p>
            <h2>
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
            {[
              "Independent websites for every venue",
              "Hall-wise availability and pricing",
              "Customer enquiries without registration",
              "Scoped access for your team",
              "Separate venue and subscription payments",
            ].map((t, i) => (
              <div key={t}>
                <span>0{i + 1}</span>
                <h3>{t}</h3>
                <Check size={17} />
              </div>
            ))}
          </div>
        </section>
        <section className="landing-cta">
          <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
          <h2>
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
        <Link to="/login">
          Owner sign in <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
