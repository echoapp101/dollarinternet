import { 
  getFirestore, 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp 
} from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { firebaseConfig, MAX_SLOTS } from "./config";
import { getPrice } from "./pricing";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const purchaseSlot = async (data: {
  message: string,
  backgroundColor: string,
  fontStyle: string,
  alignment: string
}) => {
  return runTransaction(db, async (transaction) => {
    const statsDoc = await transaction.get(doc(db, "global", "stats"));
    let stats = statsDoc.data() || { slotsSold: 0, firstSlotTimestamp: null };

    if (stats.slotsSold >= MAX_SLOTS) {
      throw new Error("Billboard full");
    }

    const newSlotsSold = stats.slotsSold + 1;
    const price = getPrice(stats.slotsSold);
    
    // Use slotNumber as document ID
    const newSlotRef = doc(db, "slots", newSlotsSold.toString());
    
    transaction.set(newSlotRef, {
      slotNumber: newSlotsSold,
      pricePaid: price,
      message: data.message,
      backgroundColor: data.backgroundColor,
      fontStyle: data.fontStyle,
      alignment: data.alignment,
      createdAt: serverTimestamp()
    });

    const updates: any = { slotsSold: newSlotsSold };
    if (!stats.firstSlotTimestamp) {
      updates.firstSlotTimestamp = serverTimestamp();
    }

    transaction.set(doc(db, "global", "stats"), updates, { merge: true });
    return { slotNumber: newSlotsSold, firstPurchase: !stats.firstSlotTimestamp };
  });
};

export { db };
