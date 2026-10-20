import Razorpay from "razorpay";

let razorpayInstance;

export const getRazorpay = () => {
  if (!razorpayInstance) {
    const key_id = process.env.VENUE_SUBSCRIPTION_RAZORPAY_KEY_ID;
    const key_secret = process.env.VENUE_SUBSCRIPTION_RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
      throw Object.assign(new Error("Platform subscription payments are not configured"), {
        statusCode: 503,
      });
    }

    razorpayInstance = new Razorpay({
      key_id,
      key_secret,
    });
  }

  return razorpayInstance;
};
