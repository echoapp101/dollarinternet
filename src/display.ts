export const getLuminance = (hex: string) => {
  const rgb = hex.replace(/^#/, '').match(/.{2}/g)?.map(x => parseInt(x, 16)) || [0, 0, 0];
  const [r, g, b] = rgb.map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const getTextColor = (bgColor: string) => {
  return getLuminance(bgColor) > 0.5 ? "text-black" : "text-white";
};

export const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const showToast = (msg: string) => {
  const toast = document.getElementById("toast")!;
  toast.textContent = msg;
  toast.classList.remove("translate-y-24", "opacity-0");
  setTimeout(() => {
    toast.classList.add("translate-y-24", "opacity-0");
  }, 3000);
};
