import type { IntegrationHealth, ShippingPackage, ShippingProvider, ShippingQuote } from '../types';

/**
 * Tabela fixa de frete por região (a partir de Natal/RN), com adicional por peso.
 * RN (59xxx) · demais estados do Nordeste (40xxx–65xxx) · resto do Brasil.
 */
export function mockShippingTable(toCep: string, pkg: ShippingPackage): ShippingQuote[] {
  const prefix = Number(toCep.slice(0, 2));
  const region = prefix === 59 ? 'RN' : prefix >= 40 && prefix <= 65 ? 'NE' : 'BR';
  const base = {
    RN: { pac: 1890, sedex: 2990, pacDays: 3, sedexDays: 1 },
    NE: { pac: 2490, sedex: 3990, pacDays: 6, sedexDays: 3 },
    BR: { pac: 3290, sedex: 5490, pacDays: 10, sedexDays: 5 },
  }[region];
  const extraHalfKilos = Math.max(0, Math.ceil(pkg.weightGrams / 500) - 1);
  return [
    {
      service: 'PAC',
      company: 'Correios',
      priceCents: base.pac + extraHalfKilos * 150,
      deliveryDays: base.pacDays,
    },
    {
      service: 'SEDEX',
      company: 'Correios',
      priceCents: base.sedex + extraHalfKilos * 250,
      deliveryDays: base.sedexDays,
    },
  ];
}

export class MockShippingProvider implements ShippingProvider {
  readonly name = 'melhorenvio';
  readonly mode = 'mock' as const;

  async quote({ toCep, pkg }: { toCep: string; pkg: ShippingPackage }): Promise<ShippingQuote[]> {
    return mockShippingTable(toCep, pkg);
  }

  async health(): Promise<IntegrationHealth> {
    return { name: this.name, mode: this.mode, status: 'up', detail: 'tabela fixa por região' };
  }
}
