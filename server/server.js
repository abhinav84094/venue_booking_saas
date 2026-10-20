import "dotenv/config";
import mongoose from "mongoose";
import { validateEnvironment } from "./config/env.js";
import connectDB, { assertHallMigrationComplete } from "./config/db.js";
import { syncEnvironmentPlans } from "./services/subscriptionPlanService.js";
import User from "./models/User.js";
import GoogleAuthorization from "./models/GoogleAuthorization.js";
import { initializeIndexes } from "./models/venueModels.js";
import { createApp, attachErrorHandlers } from "./app.js";
import { attachClient } from "./services/seoService.js";
try {
  validateEnvironment();
  await connectDB();
  await assertHallMigrationComplete();
  await User.init();
  await GoogleAuthorization.init();
  await initializeIndexes();
  await syncEnvironmentPlans();
  const app = createApp();
  await attachClient(app);
  attachErrorHandlers(app);


  const server = app.listen(Number(process.env.PORT || 5000), () =>
    console.log(`Prakash SaaS: Venue Booking API is listening on port ${process.env.PORT || 5000}`),
  );
  
  const shutdown = () =>
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
} catch (error) {
  console.error(error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
}
