import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, Save } from "lucide-react";
import { useAuth } from "../context/authContext";
import api from "../services/api";
import { Brand, Button, ErrorNotice, Field, Notice, PageHeading } from "../components/ui";

export default function AccountPage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.patch("/auth/account", { name });
      await refreshUser();
      setMessage("Your account details are saved.");
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="create-page">
      <header className="workspace-header">
        <Brand />
        <Link className="text-link" to="/venues">
          <ArrowLeft size={16} />
          All halls
        </Link>
      </header>
      <main className="create-main">
        <PageHeading eyebrow="YOUR ACCOUNT" title="A little about you." />
        <ErrorNotice error={error} />
        <Notice type="success">{message}</Notice>
        <form className="panel form-stack" onSubmit={save}>
          <Field
            label="Your name"
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Field
            label="Account email"
            type="email"
            value={user.email}
            readOnly
            hint="Use password recovery from the sign-in screen to change your password."
          />
          <Button type="submit" busy={busy}>
            <Save size={16} />
            Save account
          </Button>
        </form>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await logout();
              navigate("/login");
            } catch (failure) {
              setError(failure);
            }
          }}
        >
          <LogOut size={16} />
          Sign out
        </Button>
      </main>
    </div>
  );
}
