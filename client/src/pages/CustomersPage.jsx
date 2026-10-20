import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Users, Plus } from "lucide-react";
import { useResource } from "../hooks/useResource";
import { PageHeading, Loading, ErrorNotice, Notice, Empty, Button, Field } from "../components/ui";
import api from "../services/api";
export default function CustomersPage() {
  const { base, can } = useOutletContext(),
    [page, setPage] = useState(1),
    { data, loading, error, reload } = useResource(`${base}/customers?page=${page}`);
  const [editing, setEditing] = useState(null),
    [form, setForm] = useState({ name: "", phone: "", email: "" }),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState(null),
    [message, setMessage] = useState("");
  const edit = (customer) => {
    setEditing(customer?._id || "new");
    setForm(
      customer
        ? { name: customer.name, phone: customer.phone, email: customer.email || "" }
        : { name: "", phone: "", email: "" },
    );
  };
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setSaveError(null);
    try {
      if (editing === "new") await api.post(`${base}/customers`, form);
      else await api.patch(`${base}/customers/${editing}`, form);
      setMessage("Customer details saved.");
      setEditing(null);
      reload();
    } catch (e) {
      setSaveError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="THE PEOPLE BEHIND THE MOMENTS"
        title="Your customer book."
        action={
          can("customers:write") && (
            <Button onClick={() => edit(null)}>
              <Plus size={16} />
              Add customer
            </Button>
          )
        }
      >
        A growing collection of the people who have enquired about your venue.
      </PageHeading>
      <ErrorNotice error={error || saveError} />
      <Notice type="success">{message}</Notice>
      {editing && (
        <form className="panel form-stack" onSubmit={save}>
          <h2>{editing === "new" ? "A new connection" : "Customer details"}</h2>
          <div className="form-grid">
            <Field
              label="Customer name"
              required
              minLength={2}
              maxLength={120}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Field
              label="Phone number"
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Field
              label="Email address"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="form-footer">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Close
            </Button>
            <Button type="submit" busy={busy}>
              Save customer
            </Button>
          </div>
        </form>
      )}
      {error && <Button onClick={reload}>Try again</Button>}
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Added</th>
                  {can("customers:write") && <th>Details</th>}
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <span className="table-avatar">{c.name?.slice(0, 1)}</span>
                      <strong>{c.name}</strong>
                    </td>
                    <td>
                      <a href={`tel:${c.phone}`}>{c.phone}</a>
                    </td>
                    <td>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : "—"}</td>
                    <td>{new Date(c.createdAt).toLocaleDateString("en-IN")}</td>
                    {can("customers:write") && (
                      <td>
                        <Button variant="secondary" onClick={() => edit(c)}>
                          Edit
                        </Button>
                      </td>
                    )}
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
              {data.total} customers · Page {page}
            </span>
            <Button
              variant="secondary"
              disabled={page * 25 >= data.total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </section>
      ) : (
        !error && (
          <Empty icon={Users} title="Every connection starts somewhere.">
            Customer records are created from real booking enquiries and are private to this venue.
          </Empty>
        )
      )}
    </>
  );
}
