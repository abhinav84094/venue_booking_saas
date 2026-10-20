import { Hall, Subscription } from "../models/venueModels.js";
import { transaction, audit } from "./persistenceService.js";

export async function createHall(venue, input, actorId) {
  return transaction(async (session) => {
    const [created] = await Hall.create([{ ...input, venueId: venue._id }], { session });
    await Subscription.create(
      [{ ownerId: venue.ownerId, venueId: venue._id, hallId: created._id }],
      { session },
    );
    await audit("hall.created", venue._id, actorId, created._id, session);
    return created;
  });
}
