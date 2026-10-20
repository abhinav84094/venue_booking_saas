import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Save, UserPlus, Trash2 } from "lucide-react";
import { useAuth } from "../context/authContext";
import { useResource } from "../hooks/useResource";
import api from "../services/api";
import { PageHeading, Field, Button, Notice, ErrorNotice, Badge } from "../components/ui";
const scopes = [
  ["overview:read", "View overview"],
  ["halls:read", "View halls & pricing"],
  ["bookings:read", "View bookings & calendar"],
  ["bookings:write", "Confirm, cancel & block time"],
  ["customers:read", "View customers"],
  ["customers:write", "Add & edit customers"],
  ["payments:read", "View payment records"],
  ["payments:write", "Record receipts & refunds"],
];
export default function SettingsPage() {
  const { base } = useOutletContext(),
    { user, refreshUser } = useAuth(),
    resource = useResource(`${base}/staff`),
    [name, setName] = useState(user.name),
    [email, setEmail] = useState(""),
    [permissions, setPermissions] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [message, setMessage] = useState("");
  async function saveName(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.patch("/auth/account", { name });
      await refreshUser();
      setMessage("Your account details are saved.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function addStaff(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`${base}/staff`, { email, permissions });
      setMessage("Team access updated.");
      setEmail("");
      setPermissions([]);
      resource.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function removeStaff(id) {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`${base}/staff/${id}`);
      resource.reload();
      setMessage("Team access removed.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading eyebrow="YOUR WORKSPACE, YOUR PEOPLE" title="Account & team.">
        Keep your details current and give your team exactly the access they need.
      </PageHeading>
      <ErrorNotice error={error || resource.error} />
      <Notice type="success">{message}</Notice>
      <form className="panel form-stack" onSubmit={saveName}>
        <h2>A little about you</h2>
        <div className="form-grid">
          <Field
            label="Your name"
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label="Account email"
            type="email"
            value={user.email}
            readOnly
            hint="Use password recovery from the sign-in screen to change your password."
          />
        </div>
        <Button type="submit" busy={busy}>
          <Save size={16} />
          Save account
        </Button>
      </form>
      <section className="panel">
        <div className="section-title">
          <h2>Your venue team</h2>
          <span className="eyebrow">EXPLICITLY SCOPED ACCESS</span>
        </div>
        <p className="muted">
          Team members must have a verified account first. Staff cannot edit your venue, publish
          your website, manage subscriptions or grant access.
        </p>
        {resource.data?.staff.map((s) => (
          <div className="staff-row" key={s._id}>
            <div>
              <strong>{s.userId?.name}</strong>
              <span>{s.userId?.email}</span>
              <p className="muted small">{s.permissions.join(" · ") || "No permissions"}</p>
            </div>
            <Badge>{s.active ? "active" : "removed"}</Badge>
            {s.active && (
              <Button
                variant="ghost"
                busy={busy}
                onClick={() => removeStaff(s._id)}
                aria-label="Remove team member"
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        ))}
        <form onSubmit={addStaff} className="form-stack">
          <Field
            label="Team member’s account email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="permission-grid">
            {scopes.map(([scope, label]) => (
              <label key={scope}>
                <input
                  type="checkbox"
                  checked={permissions.includes(scope)}
                  onChange={(e) =>
                    setPermissions(
                      e.target.checked
                        ? [...permissions, scope]
                        : permissions.filter((v) => v !== scope),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <p className="muted small">
            Booking access requires hall viewing. Write access also requires the corresponding read
            permission. Recording payments requires booking viewing.
          </p>
          <Button type="submit" busy={busy}>
            <UserPlus size={16} />
            Grant or update access
          </Button>
        </form>
      </section>
    </>
  );
}
