import { Payment } from "../models/venueModels.js";
import { paymentSchema } from "../validators/venueValidator.js";
import { recordPayment } from "../services/bookingService.js";
import { paginated } from "../services/queryService.js";

export async function getPayments(req, res) {
  res.json({
    success: true,
    ...(await paginated(Payment, { venueId: req.venue._id, hallId: req.hall._id }, req.query, [
      ["bookingId", "reference eventType"],
    ])),
  });
}

export async function postPayment(req, res) {
  res.status(201).json({
    success: true,
    payment: await recordPayment(
      req.venue._id,
      paymentSchema.parse(req.body),
      req.user._id,
      req.hall._id,
    ),
  });
}
