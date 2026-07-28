const defaultCategories = [
  {
    name: "游戏新闻",
    slug: "news",
    description: "新作、发行、更新与游戏产业动态",
    sortOrder: 1,
  },
  {
    name: "科技硬件",
    slug: "hardware",
    description: "PC、主机、显示与外设的实用观察",
    sortOrder: 2,
  },
  {
    name: "游戏攻略",
    slug: "guides",
    description: "上手指南、设置建议与深度玩法解析",
    sortOrder: 3,
  },
] as const;

export async function ensureDefaultCategories(db: D1Database) {
  await db.batch(defaultCategories.map((category) => db.prepare(
    `INSERT INTO categories (name, slug, description, sort_order)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       sort_order = excluded.sort_order`
  ).bind(category.name, category.slug, category.description, category.sortOrder)));
}
