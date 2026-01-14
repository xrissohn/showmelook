-- Add StockX merchant
INSERT INTO merchants (id, name, name_ko, base_url, commission_rate, is_active, scrape_type, deeplink_template)
VALUES (
  'stockx',
  'StockX',
  '스탁엑스',
  'https://stockx.com',
  3.00,
  true,
  'manual',
  'https://click.linkprice.com/click.php?m=stockx&a={affiliate_id}&l=0000&u={encoded_url}'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  name_ko = EXCLUDED.name_ko,
  base_url = EXCLUDED.base_url,
  is_active = EXCLUDED.is_active;