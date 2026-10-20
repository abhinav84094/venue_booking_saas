import { VenueMembership } from "../models/venueModels.js";
import { staffSchema } from "../validators/venueValidator.js";
import { assignStaff, revokeStaff } from "../services/teamService.js";

export async function getStaff(req, res) {
  res.json({
    success: true,
    staff: await VenueMembership.find({ venueId: req.venue._id })
      .populate("userId", "name email")
      .lean(),
  });
}

export async function postStaff(req, res) {
  const membership = await assignStaff(req.venue, staffSchema.parse(req.body), req.user._id);
  res.json({ success: true, membership });
}

export async function deleteStaff(req, res) {
  await revokeStaff(req.venue._id, req.params.membershipId, req.user._id);
  res.json({ success: true });
}
