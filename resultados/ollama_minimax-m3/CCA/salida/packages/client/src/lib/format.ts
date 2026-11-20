export const formatMoney = (money: { amount: number; currency: string }): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: money.currency }).format(
    money.amount / 100,
  );
