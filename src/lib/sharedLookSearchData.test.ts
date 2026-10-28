import { describe, expect, it } from 'vitest';
import { buildSharedLookSearchData } from './sharedLookSearchData';

describe('shared look affiliate search data', () => {
  const products = [
    { name: 'Shirt', product_url: 'https://merchant.example/shirt', image_url: 'https://merchant.example/shirt.jpg' },
    { name: 'Shoes', product_url: 'https://merchant.example/shoes', image_url: null },
  ];

  it('lists merchant links without claiming to be a direct-sale product offer', () => {
    const data = buildSharedLookSearchData('Outfit', 'https://showmelook.com/look/example', products);
    expect(data['@type']).toBe('ItemList');
    expect(data.numberOfItems).toBe(2);
    expect(data.itemListElement.map(entry => entry.url)).toEqual(products.map(product => product.product_url));
    expect(data.itemListElement.map(entry => entry.position)).toEqual([1, 2]);
    for (const entry of data.itemListElement) {
      expect(entry['@type']).toBe('ListItem');
      expect(entry).not.toHaveProperty('item');
      expect(entry).not.toHaveProperty('offers');
      expect(entry).not.toHaveProperty('shippingDetails');
      expect(entry).not.toHaveProperty('hasMerchantReturnPolicy');
    }
  });

  it('does not substitute an AI outfit image for a missing merchant product image', () => {
    const data = buildSharedLookSearchData('Outfit', 'https://showmelook.com/look/example', products);
    expect(data.itemListElement[0].image).toBe(products[0].image_url);
    expect(data.itemListElement[1]).not.toHaveProperty('image');
  });
});