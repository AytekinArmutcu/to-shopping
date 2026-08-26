import { ProductsScreen } from '@/features/catalog/components/ProductsScreen';

/**
 * Route "/produkte": Katalogpflege (FR-4.2 bis FR-4.4).
 *
 * Der Katalog gehoert der App und nicht einer einzelnen Liste - deshalb ohne
 * Listen-ID, anders als /katalog und /ladenlayout.
 */
export default function Produkte() {
  return <ProductsScreen />;
}
