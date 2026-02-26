import { SLOTS_PER_PRICE_JUMP } from "./config";

export const getPrice = (sold: number) => Math.floor(sold / SLOTS_PER_PRICE_JUMP) + 1;

export const getSlotsUntilNextJump = (sold: number) => {
  const remainder = sold % SLOTS_PER_PRICE_JUMP;
  return remainder === 0 ? SLOTS_PER_PRICE_JUMP : SLOTS_PER_PRICE_JUMP - remainder;
};
