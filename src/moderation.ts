export const moderateText = async (text: string): Promise<boolean> => {
  // Client-side basic validation
  const lowerText = text.toLowerCase();
  if (lowerText.includes("http") || lowerText.includes("www")) {
    return false;
  }

  try {
    const response = await fetch("/.netlify/functions/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.safe === true;
  } catch (e) {
    console.error("Moderation fetch error", e);
    return false; // Fail closed
  }
};
