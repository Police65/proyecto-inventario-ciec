import { useMemo } from 'react';

interface CalculableProduct {
  quantity: number;
  precio_unitario: number;
}

interface OrderTotals {
  sub_total: number;
  iva: number;
  ret_iva: number;
  neto_a_pagar: number;
}

const IVA_RATE = 0.16; // 16%

export const useOrderCalculations = (
  products: CalculableProduct[],
  retencionPorcentajeInput?: number | null
): OrderTotals => {
  return useMemo(() => {
    const retencionPct = (retencionPorcentajeInput === null || retencionPorcentajeInput === undefined) 
      ? 75 
      : retencionPorcentajeInput;

    const sub_total = products.reduce(
      (acc, product) => acc + (Number(product.quantity) * Number(product.precio_unitario)),
      0
    );

    const iva = sub_total * IVA_RATE;
    const ret_iva = iva * (retencionPct / 100);
    const neto_a_pagar = sub_total + iva - ret_iva;

    return {
      sub_total,
      iva,
      ret_iva,
      neto_a_pagar,
    };
  }, [products, retencionPorcentajeInput]);
};