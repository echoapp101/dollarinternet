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
    const { message, backgroundColor, fontStyle, alignment } = JSON.parse(event.body || "{}");

    // 1. Validate message
    if (!message || message.length < 1 || message.length > 120) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid message length" }) };
    }

    if (message.toLowerCase().includes("http") || message.toLowerCase().includes("www")) {
      return { statusCode: 400, body: JSON.stringify({ error: "URLs are not allowed" }) };
    }

    // Strip HTML
    const cleanMessage = message.replace(/<[^>]*>?/gm, "");

    // 2. Read current slotsSold from Firestore
    const statsDoc = await db.collection("global").doc("stats").get();
    const slotsSold = statsDoc.exists ? (statsDoc.data()?.slotsSold || 0) : 0;

    if (slotsSold >= 10000) {
      return { statusCode: 400, body: JSON.stringify({ error: "Sold out" }) };
    }

    // 3. Calculate price server-side
    const price = Math.floor(slotsSold / 100) + 1;
    const unitAmount = price * 100; // In cents

    // 4. Create Stripe Checkout session
    // Use process.env.URL as requested by user
    const siteUrl = process.env.URL || event.headers.origin || event.headers.referer || "";
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `DollarInternet Slot #${slotsSold + 1}`,
              description: `Message: ${cleanMessage}`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        message: cleanMessage,
        backgroundColor,
        fontStyle,
        alignment,
      },
      success_url: `${siteUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}`,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (error: any) {
    console.error("Create checkout error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
