import User from "../models/User.js";
import { Venue, Subscription, AuditLog } from "../models/venueModels.js";
import { paginated } from "../services/queryService.js";
import { getPlatformStats, setAccountSuspension } from "../services/adminService.js";
import { suspensionSchema } from "../validators/venue/teamValidator.js";
import { syncEnvironmentPlans } from "../services/subscriptionPlanService.js";
import { must } from "../utils/errors.js";

export async function getAdminOverview(_req, res) {
  res.json({ success: true, stats: await getPlatformStats() });
}

export async function getAdminUsers(req, res) {
  res.json({
    success: true,
    ...(await paginated(User, {}, req.query).then((r) => ({
      ...r,
      items: r.items.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        suspended: u.suspended,
        emailVerified: u.emailVerified,
      })),
    }))),
  });
}

export async function getAdminVenues(req, res) {
  res.json({
    success: true,
    ...(await paginated(Venue, {}, req.query, [["ownerId", "name email"]])),
  });
}

export async function getAdminSubscriptions(req, res) {
  res.json({
    success: true,
    ...(await paginated(Subscription, { hallId: { $type: "objectId" } }, req.query, [
      ["venueId", "name slug"],
      ["hallId", "name"],
    ]).then((r) => ({
      ...r,
      items: r.items.map(({ checkoutDraft: _draft, checkoutLock: _lock, ...s }) => s),
    }))),
  });
}

export async function patchUserSuspension(req, res) {
  const { suspended } = suspensionSchema.parse(req.body);
  await setAccountSuspension(req.params.userId, suspended, req.user._id);
  res.json({ success: true });
}

export async function getPlans(_req, res) {
  res.json({ success: true, source: "environment", plans: await syncEnvironmentPlans() });
}

export function postPlan() {
  must(
    false,
    "Subscription pricing is managed in server .env. Set VENUE_PLAN_3_MONTHS_PRICE and VENUE_PLAN_1_YEAR_PRICE, then restart the server.",
    403,
  );
}

export const patchPlan = postPlan;

export async function getAudit(req, res) {
  res.json({ success: true, ...(await paginated(AuditLog, {}, req.query)) });
}
