export type Product = {
  slug: string;
  name: string;
  price: number; // USD, dollars
  category: "Sneaker" | "Loafer" | "Trekking" | "Golf";
  gender: "Men's" | "Women's" | "Unisex";
  description: string;
  image: string;
};

// Seeded from the live catalog at jgpfootwear.store. Replace `image` paths
// with your own hosted assets before launch — swap in /public/products/*.
export const products: Product[] = [
  {
    slug: "sneakers-m808-white",
    name: "Classic Sneaker M808",
    price: 350,
    category: "Sneaker",
    gender: "Men's",
    description:
      "The signature JGP silhouette. Natural-BaL Technology insole in a clean, everyday sneaker build.",
    image: "/products/m808-white.jpg"
  },
  {
    slug: "sneakers-m808-black",
    name: "Classic Sneaker M808",
    price: 350,
    category: "Sneaker",
    gender: "Men's",
    description:
      "The signature JGP silhouette in black. Natural-BaL Technology insole in a clean, everyday sneaker build.",
    image: "/products/m808-black.jpg"
  },
  {
    slug: "mens-no-lace-sneaker-m709",
    name: "No-Lace Sneaker M709",
    price: 380,
    category: "Sneaker",
    gender: "Men's",
    description:
      "Slip-on ease without giving up alignment support. Available in black, white, and black/white.",
    image: "/products/m709.jpg"
  },
  {
    slug: "trekking-mw851d",
    name: "Trekking MW851D",
    price: 400,
    category: "Trekking",
    gender: "Unisex",
    description:
      "Built for long-standing days and uneven ground, with reinforced arch and heel support.",
    image: "/products/mw851d.jpg"
  },
  {
    slug: "womens-golf-w350",
    name: "Golf W350",
    price: 480,
    category: "Golf",
    gender: "Women's",
    description:
      "Performance golf build with the same posture-conscious foundation as the rest of the line.",
    image: "/products/w350.jpg"
  },
  {
    slug: "buckle-loafer-m701n",
    name: "Buckle Loafer M701N",
    price: 400,
    category: "Loafer",
    gender: "Men's",
    description: "Formal-ready loafer, handcrafted in Korea, with the full Natural-BaL insole system.",
    image: "/products/m701n.jpg"
  },
  {
    slug: "leather-loafer-m455a",
    name: "Leather Loafer M455A",
    price: 380,
    category: "Loafer",
    gender: "Men's",
    description: "Classic leather loafer construction with posture-conscious internal geometry.",
    image: "/products/m455a.jpg"
  },
  {
    slug: "leather-loafer-m455b",
    name: "Leather Loafer M455B",
    price: 380,
    category: "Loafer",
    gender: "Men's",
    description: "A second leather finish on the M455 loafer last.",
    image: "/products/m455b.jpg"
  }
];

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug);
}
