import { Button, Field, SelectField } from "../../../components/ui";
export default function AvailabilityBlockForm({
  venue,
  block,
  setBlock,
  saveBlock,
  busy,
  onClose,
}) {
  return (
    <form onSubmit={saveBlock} className="panel form-stack block-form">
      <div className="section-title">
        <h2>Set aside a little time.</h2>
        <span className="muted small">{venue.timezone}</span>
      </div>
      <div className="form-grid">
        <Field
          label="From"
          type="datetime-local"
          required
          value={block.startAt}
          onChange={(e) => setBlock({ ...block, startAt: e.target.value })}
        />
        <Field
          label="Until"
          type="datetime-local"
          required
          value={block.endAt}
          onChange={(e) => setBlock({ ...block, endAt: e.target.value })}
        />
        <SelectField
          label="Reason category"
          value={block.type}
          onChange={(e) => setBlock({ ...block, type: e.target.value })}
        >
          <option value="MANUAL">Owner block</option>
          <option value="MAINTENANCE">Maintenance</option>
        </SelectField>
        <Field
          label="Reason"
          required
          minLength={2}
          maxLength={500}
          value={block.reason}
          onChange={(e) => setBlock({ ...block, reason: e.target.value })}
        />
      </div>
      <div className="form-footer">
        <Button variant="secondary" type="button" onClick={onClose}>
          Close
        </Button>
        <Button type="submit" busy={busy}>
          Save unavailable period
        </Button>
      </div>
    </form>
  );
}
