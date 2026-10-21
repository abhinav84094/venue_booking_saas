// Explicit, opt-in production check. A quote only reads booking/pricing data;
// {} deliberately fails validation and cannot create a booking or payment.
// No owner credentials, receipt tokens or personal data are sent.
const path = "/api/public/venues/royalpalace/halls/6ad7b95579088a82b30a04da/quote";
const origins = [
  "https://royalpalace.prakashsaas.world",
  "https://venue-booking-saas.onrender.com",
];
const fields = ["startAt", "endAt", "model"];

const results = await Promise.all(origins.map(async (origin) => {
  const url = `${origin}${path}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: "{}",
      redirect: "manual",
      signal: AbortSignal.timeout(25000),
    });
    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();
    let data;
    try { data = JSON.parse(body); } catch { /* Report the non-JSON edge response below. */ }
    const errorFields = Array.isArray(data?.errors)
      ? data.errors.map((error) => error.path)
      : [];
    const ok = response.status === 400 && contentType.includes("application/json") &&
      data?.success === false && fields.every((field) => errorFields.includes(field));
    return { url, ok, status: response.status, contentType, errorFields,
      cfRay: response.headers.get("cf-ray"),
      ...(data ? {} : { body: body.slice(0, 200) }) };
  } catch (error) {
    return { url, ok: false, error: error.name === "TimeoutError" ? "Request timed out" : error.message };
  }
}));

results.forEach((result) => console.log(JSON.stringify(result)));
if (!results.every((result) => result.ok)) {
  console.error("Quote forwarding verification failed: both URLs must return JSON 400 with startAt, endAt and model validation errors.");
  process.exitCode = 1;
}
