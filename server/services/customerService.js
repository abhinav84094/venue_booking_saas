import { Customer } from "../models/venueModels.js";
import { transaction, audit } from "./persistenceService.js";
import { must } from "../utils/errors.js";

export async function persistCustomer(venueId, hallId, input, actorId, customerId) {
  input.phone = input.phone.replace(/\D/g, "");
  return transaction(async (session) => {
    let saved;
    if (customerId) {
      saved = await Customer.findOneAndUpdate(
        { _id: customerId, venueId: venueId, hallId: hallId },
        { $set: input },
        { session, returnDocument: "after", runValidators: true },
      );
      must(saved, "Customer not found", 404);
    } else {
      [saved] = await Customer.create([{ ...input, venueId: venueId, hallId: hallId }], {
        session,
      });
    }
    await audit("customer.saved", venueId, actorId, saved._id, session);
    return saved;
  });
}
