interface AffiliateListEntry {
  name: string;
  product_url: string;
  image_url?: string | null;
}

// An editorial outfit links to merchants; it is not a merchant offer.
export function buildSharedLookSearchData(
  title: string,
  pageUrl: string,
  products: AffiliateListEntry[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    url: pageUrl,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: product.name,
      url: product.product_url,
      ...(product.image_url ? { image: product.image_url } : {}),
    })),
  };
}