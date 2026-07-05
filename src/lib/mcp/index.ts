import { defineMcp } from "@lovable.dev/mcp-js";
import searchProducts from "./tools/search-products";
import getProduct from "./tools/get-product";
import listPublicLooks from "./tools/list-public-looks";

export default defineMcp({
  name: "showmelook-mcp",
  title: "ShowMeLook MCP",
  version: "0.1.0",
  instructions:
    "Tools for ShowMeLook (쇼미룩), an AI virtual fitting and fashion styling service. Use `search_products` to find fashion items in the catalog, `get_product` to retrieve full details and the purchase link, and `list_public_looks` to browse recent public AI-generated looks from the community gallery.",
  tools: [searchProducts, getProduct, listPublicLooks],
});
