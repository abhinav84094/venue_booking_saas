import { Customer } from "../models/venueModels.js";
import { customerSchema } from "../validators/venueValidator.js";
import { persistCustomer } from "../services/customerService.js";
import { paginated } from "../services/queryService.js";

export async function getCustomers(req, res) {
  res.json({
    success: true,
    ...(await paginated(Customer, { venueId: req.venue._id, hallId: req.hall._id }, req.query)),
  });
}

export async function saveCustomer(req, res) {
  const customer = await persistCustomer(
    req.venue._id,
    req.hall._id,
    customerSchema.parse(req.body),
    req.user._id,
    req.params.customerId,
  );
  res.status(req.params.customerId ? 200 : 201).json({ success: true, customer });
}
