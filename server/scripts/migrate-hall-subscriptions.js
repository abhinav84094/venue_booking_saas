import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";

// No entitlement is copied from a venue to its halls. Historical venue payments
// and subscriptions remain intact for an explicit, provider-backed support review.
export async function migrateHallSubscriptions(db, { apply = false } = {}) {
  const halls = await db.collection("halls").find({}).toArray();
  const legacyCustomers = await db
    .collection("customers")
    .find({ hallId: { $exists: false } })
    .toArray();
  const report = {
    apply,
    halls: halls.length,
    legacySubscriptions: await db
      .collection("subscriptions")
      .countDocuments({ hallId: { $exists: false } }),
    legacyCustomers: legacyCustomers.length,
    legacyPayments: await db.collection("payments").countDocuments({ hallId: { $exists: false } }),
    unassignedCustomers: 0,
  };
  for (const customer of legacyCustomers) {
    const references = await db
      .collection("bookings")
      .distinct("hallId", { customerId: customer._id, venueId: customer.venueId });
    if (!references.length) report.unassignedCustomers++;
  }
  if (!apply) return report;
  await db
    .collection("subscriptions")
    .createIndex(
      { hallId: 1 },
      { unique: true, partialFilterExpression: { hallId: { $type: "objectId" } } },
    );
  await db
    .collection("customers")
    .createIndex({ venueId: 1, hallId: 1, phone: 1 }, { unique: true });
  // Remove only the two superseded uniqueness constraints, preserving all rows.
  for (const [collection, key] of [
    ["subscriptions", { venueId: 1 }],
    ["customers", { venueId: 1, phone: 1 }],
  ]) {
    for (const index of await db.collection(collection).listIndexes().toArray()) {
      if (index.unique && JSON.stringify(index.key) === JSON.stringify(key))
        await db.collection(collection).dropIndex(index.name);
    }
  }
  for (const hall of halls) {
    const venue = await db.collection("venues").findOne({ _id: hall.venueId });
    if (!venue?.ownerId)
      throw new Error("A hall has no valid venue owner; resolve the orphan before migration");
    const existing = await db.collection("subscriptions").findOne({ hallId: hall._id });
    if (
      existing &&
      (!existing.venueId.equals(venue._id) || !existing.ownerId?.equals(venue.ownerId))
    )
      throw new Error(
        "An existing hall subscription has inconsistent ownership; manual review required",
      );
    await db.collection("subscriptions").updateOne(
      { hallId: hall._id },
      {
        $setOnInsert: {
          ownerId: venue.ownerId,
          venueId: venue._id,
          hallId: hall._id,
          status: "pending",
          checkoutLock: null,
          checkoutDraft: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          __v: 0,
        },
      },
      { upsert: true },
    );
  }
  // Include scoped customers too, making interrupted cross-hall cloning resumable.
  const customers = await db.collection("customers").find({}).toArray();
  for (const customer of customers) {
    const hallIds = await db
      .collection("bookings")
      .distinct("hallId", { customerId: customer._id, venueId: customer.venueId });
    // Customers with no booking cannot be assigned safely; retain for support.
    for (const hallId of hallIds) {
      const session = db.client.startSession();
      try {
        await session.withTransaction(async () => {
          let scoped = await db
            .collection("customers")
            .findOne({ venueId: customer.venueId, hallId, phone: customer.phone }, { session });
          if (!scoped) {
            const original = await db
              .collection("customers")
              .findOne({ _id: customer._id }, { session });
            if (!original.hallId) {
              await db
                .collection("customers")
                .updateOne({ _id: original._id }, { $set: { hallId } }, { session });
              scoped = original;
            } else {
              const { _id: _oldId, ...fields } = original;
              const result = await db
                .collection("customers")
                .insertOne({ ...fields, hallId }, { session });
              scoped = { _id: result.insertedId };
            }
          }
          await db
            .collection("bookings")
            .updateMany(
              { venueId: customer.venueId, hallId, customerId: customer._id },
              { $set: { customerId: scoped._id } },
              { session },
            );
        });
      } finally {
        await session.endSession();
      }
    }
  }
  for await (const payment of db.collection("payments").find({ hallId: { $exists: false } })) {
    const booking = await db
      .collection("bookings")
      .findOne({ _id: payment.bookingId, venueId: payment.venueId });
    if (booking)
      await db
        .collection("payments")
        .updateOne({ _id: payment._id }, { $set: { hallId: booking.hallId } });
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.env.VENUE_MONGO_URI || !/venue/i.test(process.env.VENUE_DB_NAME || ""))
      throw new Error("Configure the independent VENUE_MONGO_URI and VENUE_DB_NAME first");
    await mongoose.connect(process.env.VENUE_MONGO_URI, {
      dbName: process.env.VENUE_DB_NAME,
      autoIndex: false,
      autoCreate: false,
    });
    console.log(
      JSON.stringify(
        await migrateHallSubscriptions(mongoose.connection.db, {
          apply: process.argv.includes("--apply"),
        }),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
