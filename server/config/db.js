import mongoose from "mongoose";
export async function assertHallMigrationComplete(db = mongoose.connection.db) {
  for (const [name, key] of [
    ["subscriptions", { venueId: 1 }],
    ["customers", { venueId: 1, phone: 1 }],
  ]) {
    const exists = await db.listCollections({ name }).hasNext();
    if (!exists) continue;
    const indexes = await db.collection(name).listIndexes().toArray();
    if (indexes.some((index) => index.unique && JSON.stringify(index.key) === JSON.stringify(key)))
      throw new Error(
        "Existing venue-level indexes require migration. Review node scripts/migrate-hall-subscriptions.js, then run it with --apply before starting the API.",
      );
  }
}
export default async function connectDB() {
  await mongoose.connect(process.env.VENUE_MONGO_URI, {
    dbName: process.env.VENUE_DB_NAME,
    serverSelectionTimeoutMS: 10000,
  });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid")
    throw new Error(
      "Venue bookings require a MongoDB replica set or sharded cluster for atomic transactions",
    );
}
