export const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format((value || 0) / 100);
export const dateTime = (value, zone = "Asia/Kolkata") =>
  new Date(value).toLocaleString("en-IN", {
    timeZone: zone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const localDate = (value, zone) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export const toPaise = (value) => {
  const raw = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw))
    throw new Error("Use a positive amount with up to two decimal places");
  const [whole, fraction = ""] = raw.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount)) throw new Error("Amount is too large");
  return amount;
};
