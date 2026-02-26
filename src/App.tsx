const params = new URLSearchParams(window.location.search);
const sessionId = params.get("session_id");

if (sessionId) {
  fetch("/.netlify/functions/confirm-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId })
  })
  .then(res => res.json())
  .then(() => {
    window.history.replaceState({}, document.title, "/");
    window.location.reload();
  })
  .catch(err => console.error("Confirmation failed:", err));
}

import { 
  onSnapshot, 
  doc, 
  query, 
  collection, 
  orderBy 
} from "firebase/firestore";
import { db } from "./transactions";
import { getPrice, getSlotsUntilNextJump } from "./pricing";
import { moderateText } from "./moderation";
import { 
  getTextColor, 
  formatTime, 
  showToast 
} from "./display";
import { PREDEFINED_COLORS, MAX_SLOTS } from "./config";

// --- STATE ---
let globalStats: any = { slotsSold: 0, firstSlotTimestamp: null };
let allSlots: any[] = [];
let selectedColor = PREDEFINED_COLORS[0];
let selectedAlign = "text-center";
let isFirstLaunchTransition = false;

// --- UI ELEMENTS ---
const elements = {
  statSlots: document.getElementById("stat-slots")!,
  statPrice: document.getElementById("stat-price")!,
  statNext: document.getElementById("stat-next")!,
  countdownTimer: document.getElementById("countdown-timer")!,
  countdownTimerMobile: document.getElementById("countdown-timer-mobile")!,
  billboard: document.getElementById("billboard")!,
  activeMessage: document.getElementById("active-message")!,
  activeMeta: document.getElementById("active-meta")!,
  btnBuy: document.getElementById("btn-buy")!,
  btnBuyMobile: document.getElementById("btn-buy-mobile")!,
  modalBuy: document.getElementById("modal-buy")!,
  btnCloseModal: document.getElementById("btn-close-modal")!,
  formBuy: document.getElementById("form-buy") as HTMLFormElement,
  inputMessage: document.getElementById("input-message") as HTMLTextAreaElement,
  selectFont: document.getElementById("select-font") as HTMLSelectElement,
  colorPicker: document.getElementById("color-picker")!,
  modalPrice: document.getElementById("modal-price")!,
  btnSubmit: document.getElementById("btn-submit") as HTMLButtonElement,
  navHome: document.getElementById("nav-home")!,
  btnAbout: document.getElementById("btn-about")!,
  btnAboutMobile: document.getElementById("btn-about-mobile")!,
  btnBackHome: document.getElementById("btn-back-home")!,
  sectionAbout: document.getElementById("section-about")!,
};

// --- CORE LOGIC ---
const updateDisplay = () => {
  if (isFirstLaunchTransition) return;

  if (globalStats.slotsSold >= MAX_SLOTS) {
    elements.activeMessage.textContent = "SOLD OUT";
    elements.activeMeta.textContent = "10,000 Minutes Claimed. This page is now permanent.";
    elements.billboard.style.backgroundColor = "#000000";
    elements.activeMessage.className = "text-3xl md:text-7xl lg:text-8xl font-black leading-tight break-words font-sans text-center text-white";
    elements.btnBuy.classList.add("hidden");
    elements.modalBuy.classList.add("hidden");
    elements.countdownTimer.parentElement?.classList.add("hidden");
    return;
  }

  if (globalStats.slotsSold === 0) {
    elements.activeMessage.textContent = "This minute could be yours.";
    elements.activeMeta.textContent = "Become the first slot holder";
    elements.billboard.style.backgroundColor = "#000000";
    elements.activeMessage.className = "text-3xl md:text-7xl lg:text-8xl font-black leading-tight break-words font-sans text-center text-white";
    return;
  }

  const now = Date.now();
  const firstTime = globalStats.firstSlotTimestamp?.toMillis() || now;
  const elapsedSeconds = Math.floor((now - firstTime) / 1000);
  const currentIndex = Math.floor(elapsedSeconds / 60) % globalStats.slotsSold;
  
  const activeSlot = allSlots.find(s => s.slotNumber === (currentIndex + 1));

  if (activeSlot) {
    const textColor = getTextColor(activeSlot.backgroundColor);
    elements.activeMessage.textContent = activeSlot.message;
    elements.activeMeta.textContent = `Currently owned by Slot #${activeSlot.slotNumber} — Paid $${activeSlot.pricePaid}`;
    elements.activeMeta.className = `text-[10px] md:text-sm uppercase tracking-[0.3em] font-mono ${textColor === 'text-white' ? 'text-white/40' : 'text-black/40'}`;
    elements.billboard.style.backgroundColor = activeSlot.backgroundColor;
    elements.activeMessage.className = `text-3xl md:text-7xl lg:text-8xl font-black leading-tight break-words ${activeSlot.fontStyle} ${activeSlot.alignment} ${textColor}`;
    
    const secondsRemaining = 60 - (elapsedSeconds % 60);
    const timeStr = formatTime(secondsRemaining);
    elements.countdownTimer.textContent = timeStr;
    if (elements.countdownTimerMobile) {
      elements.countdownTimerMobile.textContent = timeStr;
    }
  } else {
    elements.activeMessage.textContent = "Loading next slot...";
  }
};

// --- DATA SYNC ---
onSnapshot(doc(db, "global", "stats"), (docSnap) => {
  if (docSnap.exists()) {
    globalStats = docSnap.data();
    elements.statSlots.textContent = `${globalStats.slotsSold} / 10,000`;
    const price = getPrice(globalStats.slotsSold);
    elements.statPrice.textContent = `$${price}`;
    const nextJump = getSlotsUntilNextJump(globalStats.slotsSold);
    elements.statNext.textContent = `${nextJump}`;
    elements.modalPrice.textContent = `$${price}.00`;
    updateDisplay();
  }
});

onSnapshot(query(collection(db, "slots"), orderBy("slotNumber", "asc")), (snapshot) => {
  allSlots = snapshot.docs.map(d => d.data());
  updateDisplay();
});

// --- EVENT HANDLERS ---
elements.btnCloseModal.onclick = () => {
  elements.modalBuy.classList.add("hidden");
};

// --- NAVIGATION ---
const showAbout = () => {
  elements.billboard.classList.add("hidden");
  elements.sectionAbout.classList.remove("hidden");
  window.scrollTo(0, 0);
};

const showHome = () => {
  elements.billboard.classList.remove("hidden");
  elements.sectionAbout.classList.add("hidden");
  window.scrollTo(0, 0);
};

elements.btnAbout.onclick = showAbout;
if (elements.btnAboutMobile) elements.btnAboutMobile.onclick = showAbout;
elements.navHome.onclick = showHome;
elements.btnBackHome.onclick = showHome;

elements.btnBuy.onclick = () => {
  if (globalStats.slotsSold >= MAX_SLOTS) return;
  elements.modalBuy.classList.remove("hidden");
};

if (elements.btnBuyMobile) {
  elements.btnBuyMobile.onclick = () => {
    if (globalStats.slotsSold >= MAX_SLOTS) return;
    elements.modalBuy.classList.remove("hidden");
  };
}
PREDEFINED_COLORS.forEach(color => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "w-full aspect-square rounded-lg border border-white/10 transition-transform hover:scale-110";
  btn.style.backgroundColor = color;
  btn.onclick = () => {
    selectedColor = color;
    document.querySelectorAll("#color-picker button").forEach(b => (b as HTMLElement).style.borderColor = "rgba(255,255,255,0.1)");
    btn.style.borderColor = "white";
  };
  elements.colorPicker.appendChild(btn);
});

// Alignment Init
document.querySelectorAll(".btn-align").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedAlign = (btn as HTMLElement).dataset.align!;
    document.querySelectorAll(".btn-align").forEach(b => {
      b.classList.remove("bg-white", "text-black");
      b.classList.add("bg-black", "text-white");
    });
    btn.classList.remove("bg-black", "text-white");
    btn.classList.add("bg-white", "text-black");
  });
});

elements.formBuy.onsubmit = async (e) => {
  e.preventDefault();
  
  const message = elements.inputMessage.value.trim();
  if (message.length === 0 || message.length > 120) {
    showToast("Message must be 1-120 characters.");
    return;
  }

  elements.btnSubmit.disabled = true;
  elements.btnSubmit.textContent = "Moderating...";

  const isSafe = await moderateText(message);
  if (!isSafe) {
    showToast("Message rejected. No URLs allowed and content must be safe.");
    elements.btnSubmit.disabled = false;
    elements.btnSubmit.textContent = "Purchase Slot";
    return;
  }

  elements.btnSubmit.textContent = "Redirecting to Stripe...";

  try {
    const response = await fetch("/.netlify/functions/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        backgroundColor: selectedColor,
        fontStyle: elements.selectFont.value,
        alignment: selectedAlign
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to create checkout session");
    }

    const data = await response.json();
    
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error("No checkout URL returned");
    }
  } catch (err: any) {
    console.error(err);
    showToast(err.message || "Checkout failed. Please try again.");
    elements.btnSubmit.disabled = false;
    elements.btnSubmit.textContent = "Purchase Slot";
  }
};

setInterval(updateDisplay, 1000);
updateDisplay();
