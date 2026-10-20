import { useState } from "react";
import api from "../../../services/api";
import { useResource } from "../../../hooks/useResource";
import { localDate } from "../../../utils/format";
export function useAvailability(base, venue) {
  const halls = useResource(`${base}/halls`);
  const [hallId, setHallId] = useState(""),
    [month, setMonth] = useState(() =>
      new Date()
        .toLocaleDateString("en-CA", {
          timeZone: venue.timezone,
          year: "numeric",
          month: "2-digit",
        })
        .slice(0, 7),
    );
  const selectedHall = hallId || halls.data?.halls[0]?._id;
  const [year, mo] = month.split("-").map(Number),
    days = new Date(Date.UTC(year, mo, 0)).getUTCDate(),
    offset = new Date(Date.UTC(year, mo - 1, 1)).getUTCDay();
  const nextMonth = `${mo === 12 ? year + 1 : year}-${String(mo === 12 ? 1 : mo + 1).padStart(2, "0")}`;
  const url = selectedHall
    ? `${base}/availability/${selectedHall}?startAt=${month}-01T00:00&endAt=${nextMonth}-01T00:00`
    : null;
  const availability = useResource(url),
    [showBlock, setShowBlock] = useState(false),
    [error, setError] = useState(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [selectedDay, setSelectedDay] = useState("");
  const [block, setBlock] = useState({ startAt: "", endAt: "", reason: "", type: "MANUAL" });
  const intervals = availability.data?.busy || [];
  async function saveBlock(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`${base}/blocks`, { ...block, hallId: selectedHall });
      setMessage("Unavailable period added.");
      setShowBlock(false);
      availability.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id) {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`${base}/blocks/${id}`);
      setMessage("Unavailable period removed.");
      availability.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  function forDay(day) {
    return intervals.filter(
      (b) =>
        localDate(b.startAt, venue.timezone) <= day &&
        localDate(new Date(b.endAt).getTime() - 1, venue.timezone) >= day,
    );
  }
  return {
    halls,
    hallId,
    setHallId,
    month,
    setMonth,
    selectedHall,
    year,
    mo,
    days,
    offset,
    availability,
    showBlock,
    setShowBlock,
    error,
    message,
    busy,
    selectedDay,
    setSelectedDay,
    block,
    setBlock,
    saveBlock,
    remove,
    forDay,
  };
}
