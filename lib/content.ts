export type CategoryKey = "news" | "hardware" | "guides";

export type Article = {
  id: number;
  slug: string;
  title: string;
  dek: string;
  category: CategoryKey;
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  tone: "lime" | "cyan" | "violet" | "orange";
  kicker: string;
  content: string[];
  sourceName: string;
  sourceUrl: string;
  featured?: boolean;
  popular?: boolean;
};

export const categoryMeta: Record<
  CategoryKey,
  { name: string; description: string; href: string }
> = {
  news: {
    name: "游戏新闻",
    description: "新作、发行、更新与游戏产业动态",
    href: "/news",
  },
  hardware: {
    name: "科技硬件",
    description: "PC、主机、显示与外设的实用观察",
    href: "/hardware",
  },
  guides: {
    name: "游戏攻略",
    description: "上手指南、设置建议与深度玩法解析",
    href: "/guides",
  },
};

export const articles: Article[] = [
  {
    id: 1,
    slug: "how-timiu-reports-game-news",
    title: "一条游戏新闻如何成为可靠报道：TIMIU 的首版编辑流程",
    dek: "从 RSS 线索、交叉核验到人工发布，我们把每一步的边界公开说明。",
    category: "news",
    tags: ["游戏产业", "编辑规范", "发售情报"],
    publishedAt: "2026-07-28T09:00:00+08:00",
    updatedAt: "2026-07-28T09:00:00+08:00",
    readingMinutes: 6,
    tone: "lime",
    kicker: "本站公告",
    featured: true,
    popular: true,
    sourceName: "TIMIU 编辑部",
    sourceUrl: "/about",
    content: [
      "TIMIU 游戏资讯的第一版从一个简单原则出发：速度重要，但事实边界更重要。RSS 只被视为选题线索，而不是可以直接改写发布的完整事实。每个主选题进入工作台后，会先保留原始标题、发布时间、摘要和来源链接，再寻找时间接近、事件一致的补充资料。",
      "系统默认从最多 100 条素材中匹配相关新闻，关联时间范围为 14 天，最多采用 4 条补充来源。匹配会综合游戏名称、公司、人物、版本号和事件语义；当版本数字冲突时，候选资料会被排除，避免把同系列不同作品误合并。",
      "处理阶段默认只产生短讯草稿，不使用 AI 重写长文。素材不足、来源互相矛盾或包含未经证实的传闻时，稿件会进入“需要人工审核”状态。编辑可以查看所有实际使用的来源与失败原因，再决定修改、定时发布或撤回。",
      "第一阶段不会自动公开发布。自动发布开关将保持关闭，直到多轮测试证明来源、重复检测、栏目判断和文章质量都稳定。即使未来启用，系统也必须同时满足置信度、字数、来源与非传闻等保护条件。",
      "这篇文章也是一个产品说明：当前站内首批卡片为版式与流程演示内容，不代表真实世界中刚刚发生的新闻。正式新闻接入会在管理员配置安全密钥、完成草稿测试并明确批准后开始。",
    ],
  },
  {
    id: 2,
    slug: "pc-settings-before-new-game",
    title: "新游戏开玩前，先检查这五项 PC 设置",
    dek: "驱动、着色器、帧率上限与显示模式，往往比盲目降低画质更值得先处理。",
    category: "guides",
    tags: ["PC游戏", "硬件", "Steam"],
    publishedAt: "2026-07-28T08:20:00+08:00",
    updatedAt: "2026-07-28T08:20:00+08:00",
    readingMinutes: 5,
    tone: "cyan",
    kicker: "实用指南",
    popular: true,
    sourceName: "TIMIU 攻略组",
    sourceUrl: "/about",
    content: [
      "第一次启动大型 PC 游戏时，最常见的体验问题并不一定来自显卡性能。后台程序、驱动版本、显示刷新率和着色器编译，都可能造成帧率不稳或输入延迟。建议先确认系统与显卡驱动处于稳定版本，并关闭不必要的录屏与叠加层。",
      "第二步是检查游戏是否正确识别显示器刷新率。无边框窗口在部分环境中会跟随桌面设置，全屏模式则可能提供独立选项。不要只看平均帧率，稳定的帧时间通常更直接影响操作手感。",
      "如果游戏提供着色器预编译，让它完整结束再进入关卡。中途跳过可能把编译压力转移到实际游玩中。之后再根据显存容量调整纹理，根据 GPU 余量调整阴影、体积光和光线追踪。",
      "最后，为帧率设置一个设备可以长期维持的上限。稳定的 60 或 90 帧往往比在 70 到 120 帧之间剧烈波动更舒服。每次只修改一到两个选项，才能判断究竟是哪项设置带来了改善。",
    ],
  },
  {
    id: 3,
    slug: "console-storage-buying-guide",
    title: "主机扩容怎么选：容量、速度与预算的三角关系",
    dek: "买得更大不一定更合适，先根据游戏库结构判断真正需要的空间。",
    category: "hardware",
    tags: ["PlayStation", "Xbox", "Nintendo", "硬件"],
    publishedAt: "2026-07-27T18:40:00+08:00",
    updatedAt: "2026-07-28T07:45:00+08:00",
    readingMinutes: 7,
    tone: "violet",
    kicker: "硬件课堂",
    featured: true,
    sourceName: "TIMIU 硬件组",
    sourceUrl: "/about",
    content: [
      "评估主机扩容时，第一件事不是比较标称速度，而是统计常驻游戏数量。只保留两三款长期游玩的玩家，可能更适合中等容量；经常轮换大型作品或网络环境较慢的玩家，额外空间的价值会明显提高。",
      "不同主机对存储设备的兼容方式不同。有些扩展可以直接运行本世代游戏，有些主要用于归档或运行向下兼容内容。购买前应以主机厂商当前的官方兼容说明为准，并确认散热、尺寸和接口要求。",
      "容量越大，单 GB 价格通常越低，但一次投入也更高。把未来两年的预计需求、保修年限和更换便利度一起考虑，往往比追求最高规格更实用。",
      "这篇演示稿不列出具体型号与价格，因为这些信息会快速变化。正式选购文章会核对厂商规格、授权情况与当前市场价格，并明确记录信息日期。",
    ],
  },
  {
    id: 4,
    slug: "indie-game-launch-window",
    title: "独立游戏为什么越来越重视发售窗口",
    dek: "避开同类大作只是开始，试玩活动、愿望单与内容更新正在共同影响首发节奏。",
    category: "news",
    tags: ["独立游戏", "Steam", "游戏产业"],
    publishedAt: "2026-07-27T15:10:00+08:00",
    updatedAt: "2026-07-27T15:10:00+08:00",
    readingMinutes: 6,
    tone: "orange",
    kicker: "产业观察",
    popular: true,
    sourceName: "TIMIU 编辑部",
    sourceUrl: "/about",
    content: [
      "对资源有限的独立团队来说，发售日期不只是开发排期的终点，也是商店曝光、媒体注意力和社区活跃度交汇的时刻。与同类高关注作品直接碰撞，可能让有限的传播预算更难形成有效触达。",
      "因此，团队往往会把试玩反馈、愿望单增长、平台活动和内容完成度放在同一张时间表中。延期并不总意味着开发失败，有时是为了争取更合适的市场窗口或处理集中出现的体验问题。",
      "但窗口判断也不能取代产品本身。清晰的核心玩法、稳定版本和持续沟通仍然是长期口碑的基础。正式产业报道会引用可核验的开发者公开说明与平台资料，不把推测包装成结论。",
    ],
  },
  {
    id: 5,
    slug: "handheld-battery-performance",
    title: "掌机续航与性能如何平衡：先从功耗目标开始",
    dek: "锁帧、亮度和无线连接共同决定续航，单看电池容量容易得出错误结论。",
    category: "hardware",
    tags: ["PC游戏", "硬件", "掌机"],
    publishedAt: "2026-07-26T21:30:00+08:00",
    updatedAt: "2026-07-26T21:30:00+08:00",
    readingMinutes: 4,
    tone: "cyan",
    kicker: "便携设备",
    sourceName: "TIMIU 硬件组",
    sourceUrl: "/about",
    content: [
      "便携设备的续航测试必须同时说明性能模式、屏幕亮度、音量、网络状态和目标帧率。缺少这些条件，只比较一个小时数，很难对真实使用产生帮助。",
      "从稳定帧率开始设置通常最有效。对节奏较慢的游戏，降低帧率上限可以显著减少功耗；对强调反应速度的作品，则需要在流畅度和续航之间寻找更高的平衡点。",
      "正式评测会记录测试版本与环境，并至少重复关键场景。首版网站先建立这些信息字段，避免以后只展示看似精确、实际不可复现的数字。",
    ],
  },
  {
    id: 6,
    slug: "rpg-first-hours-checklist",
    title: "RPG 开荒清单：前两小时别忽略的六件事",
    dek: "先理解存档、难度和成长系统，能减少中后期被迫重开的成本。",
    category: "guides",
    tags: ["RPG", "动作游戏", "新手攻略"],
    publishedAt: "2026-07-26T12:00:00+08:00",
    updatedAt: "2026-07-26T12:00:00+08:00",
    readingMinutes: 5,
    tone: "lime",
    kicker: "开荒指南",
    sourceName: "TIMIU 攻略组",
    sourceUrl: "/about",
    content: [
      "进入一款陌生 RPG 后，先确认自动存档触发方式与手动存档限制。部分作品会在进入危险区域前覆盖自动存档，保留多个轮换档位可以减少意外损失。",
      "接着阅读难度说明和属性解释。不要只根据名称判断难度，有些游戏允许随时调整，有些则会影响奖励或成就。成长资源在前期看似充足，实际可能承担多种用途。",
      "最后留意地图图例、快速旅行条件、队友指令和可重置机制。攻略的目标不是替玩家作决定，而是提前说明不可逆选择，让探索仍然保留空间。",
    ],
  },
];

export const allTags = Array.from(new Set(articles.flatMap((article) => article.tags)));

export function getArticle(slug: string) {
  return articles.find((article) => article.slug === slug);
}

export function getCategoryArticles(category: CategoryKey) {
  return articles.filter((article) => article.category === category);
}

export function getTagArticles(tag: string) {
  return articles.filter((article) => article.tags.includes(decodeURIComponent(tag)));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}
