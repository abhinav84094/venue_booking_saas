import { Booking } from "../models/venueModels.js";
import { blockSchema, bookingStatusSchema } from "../validators/venueValidator.js";
import {
  createBlock,
  removeBlock,
  transitionBooking,
  bookingPaymentState,
  expireEnquiries,
} from "../services/bookingService.js";
import { pageQuery, paginated } from "../services/queryService.js";
import { must } from "../utils/errors.js";

export async function getBookings(req, res) {
  await expireEnquiries(req.venue._id, req.hall._id);
  const { status, reference } = pageQuery.parse(req.query);
  if (status)
    must(
      ["ENQUIRY", "PENDING", "CONFIRMED", "COMPLETED", "REJECTED", "CANCELLED", "EXPIRED"].includes(
        status,
      ),
      "Invalid booking status",
    );
  const result = await paginated(
    Booking,
    {
      venueId: req.venue._id,
      hallId: req.hall._id,
      ...(status ? { status } : {}),
      ...(reference ? { reference } : {}),
    },
    req.query,
    [
      ["customerId", "name phone email"],
      ["hallId", "name"],
    ],
  );
  res.json({
    success: true,
    ...result,
    items: result.items.map((b) => ({ ...b, paymentState: bookingPaymentState(b) })),
  });
}

export async function patchBooking(req, res) {
  const { status } = bookingStatusSchema.parse(req.body);
  res.json({
    success: true,
    booking: await transitionBooking(
      req.venue._id,
      req.params.bookingId,
      status,
      req.user._id,
      req.hall._id,
    ),
  });
}

export async function postBlock(req, res) {
  must(String(req.body?.hallId) === String(req.hall._id), "Hall identity mismatch", 404);
  res.status(201).json({
    success: true,
    block: await createBlock(req.venue, blockSchema.parse(req.body), req.user._id),
  });
}

export async function deleteBlock(req, res) {
  await removeBlock(req.venue._id, req.params.blockId, req.user._id, req.hall._id);
  res.json({ success: true });
}
