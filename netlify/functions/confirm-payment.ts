import { Handler } from "@netlify/functions";
import Stripe from "stripe";
import admin from "firebase-admin";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Handle newline characters in private key
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { session_id } = JSON.parse(event.body || "{}");

    if (!session_id) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: "Missing session_id" }) };
    }

    // 1. Retrieve Stripe session
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // 2. Confirm payment status
    if (session.payment_status !== "paid") {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: "Payment not confirmed" }) };
    }

    // 3. Extract metadata
    const { message, backgroundColor, fontStyle, alignment } = session.metadata || {};
    const pricePaid = session.amount_total ? session.amount_total / 100 : 0;

    // 4. Run Firestore transaction
    const result = await db.runTransaction(async (transaction) => {
      const statsRef = db.collection("global").doc("stats");
      const statsDoc = await transaction.get(statsRef);
      
      let slotsSold = 0;
      let firstSlotTimestamp = null;

      if (statsDoc.exists) {
        slotsSold = statsDoc.data()?.slotsSold || 0;
        firstSlotTimestamp = statsDoc.data()?.firstSlotTimestamp || null;
      }

      // Check if sold out
      if (slotsSold >= 10000) {
        throw new Error("Sold out");
      }

      // Increment slotsSold
      const newSlotsSold = slotsSold + 1;
      const slotNumber = newSlotsSold.toString();

      // Check if this slot already exists (idempotency)
      const slotRef = db.collection("slots").doc(slotNumber);
      const slotDoc = await transaction.get(slotRef);
      if (slotDoc.exists) {
        return { success: true, alreadyExists: true };
      }

      // Update global stats
      const statsUpdate: any = { slotsSold: newSlotsSold };
      if (!firstSlotTimestamp) {
        statsUpdate.firstSlotTimestamp = admin.firestore.FieldValue.serverTimestamp();
      }
      transaction.set(statsRef, statsUpdate, { merge: true });

      // Create slot document
      transaction.set(slotRef, {
        message,
        backgroundColor,
        fontStyle,
        alignment,
        pricePaid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        slotNumber: newSlotsSold,
        stripeSessionId: session_id,
      });

      return { success: true };
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    console.error("Confirm payment error:", error);
    return {
      statusCode: 200, // Still return 200 but success: false as requested for Stripe verification failure
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
