// Demo store catalogue — shared between frontend (display) and backend (pricing).
export interface DemoProduct {
  id: string;
  name: string;
  nameZh: string;
  price: number; // HKD
  tag: string;
  glyph: string; // terminal-glyph "artwork"
}

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: "coffee",
    name: "Drip Coffee",
    nameZh: "手沖咖啡",
    price: 38,
    tag: "beverage",
    glyph: "c[_]",
  },
  {
    id: "sandwich",
    name: "Egg Sandwich",
    nameZh: "雞蛋三文治",
    price: 42,
    tag: "food",
    glyph: "▤▤▤",
  },
  {
    id: "croissant",
    name: "Butter Croissant",
    nameZh: "牛油牛角酥",
    price: 28,
    tag: "bakery",
    glyph: "◠◡◠",
  },
  {
    id: "beans",
    name: "Coffee Beans 200g",
    nameZh: "咖啡豆 200g",
    price: 168,
    tag: "retail",
    glyph: "░░▓▓",
  },
];
