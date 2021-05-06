export const roundToNDecimalPlaces = (n: number, places: number) => {
  return Math.round(n * 10 ** places) / 10 ** places;
};
