import assert from "node:assert/strict";
import test from "node:test";
import { canAutoPublish, hasVersionConflict, titleSimilarity } from "../lib/automation.ts";
import { detectLanguage, feedUrlWithLimit, prepareFeedItems, stripHtml } from "../lib/feed.ts";
import { mediaUrl, safeCoverKey } from "../lib/media.ts";
import {
  constantTimeEqual,
  hashAuthValue,
  isAllowedAdminEmail,
  normalizeEmail,
  safeAdminReturnTo,
} from "../lib/admin-auth-crypto.ts";
import { readFile } from "node:fs/promises";

test("版本数字冲突会阻止错误合并", () => {
  assert.equal(hasVersionConflict("《黑色行动 2》发布更新", "《黑色行动 7》发布更新"), true);
  assert.equal(titleSimilarity("《黑色行动 2》发布更新", "《黑色行动 7》发布更新"), 0);
});

test("相同事件标题能得到有效相似度", () => {
  assert.ok(titleSimilarity("某独立游戏 公布 发售日期", "某独立游戏 确认 发售日期") >= 0.45);
});

test("自动发布必须满足全部安全条件", () => {
  const safe = {
    enabled: true,
    confidence: 0.92,
    contentChars: 960,
    sourceCount: 2,
    hasConflict: false,
    isRumor: false,
    isDuplicate: false,
    categoryValid: true,
  };
  assert.equal(canAutoPublish(safe), true);
  assert.equal(canAutoPublish({ ...safe, enabled: false }), false);
  assert.equal(canAutoPublish({ ...safe, confidence: 0.89 }), false);
  assert.equal(canAutoPublish({ ...safe, contentChars: 799 }), false);
  assert.equal(canAutoPublish({ ...safe, sourceCount: 0 }), false);
  assert.equal(canAutoPublish({ ...safe, hasConflict: true }), false);
  assert.equal(canAutoPublish({ ...safe, isRumor: true }), false);
  assert.equal(canAutoPublish({ ...safe, isDuplicate: true }), false);
});

test("Gemini 3.6 使用 Interactions API 与搜索工具", async () => {
  const route = await readFile(new URL("../app/api/automation/draft/route.ts", import.meta.url), "utf8");
  assert.match(route, /AI_REWRITE_ENABLED !== "true"/);
  assert.match(route, /AI 长文重写已关闭/);
  assert.match(route, /v1beta\/interactions/);
  assert.match(route, /type: "google_search"/);
  assert.match(route, /response_format/);
  assert.doesNotMatch(route, /generationConfig|temperature/);
});

test("RSS 摘要会清理 HTML 并识别中文", () => {
  assert.equal(stripHtml("<p>新作&nbsp;<b>发售</b></p>"), "新作 发售");
  assert.equal(detectLanguage("这是一条中文游戏新闻摘要"), "zh");
  assert.equal(detectLanguage("This is an English game news summary"), "other");
});

test("RSS 入库限制数量并标记重复与待翻译", async () => {
  const items = await prepareFeedItems([
    { id: "1", title: "某游戏公布发售日期", canonical: [{ href: "https://example.com/a" }], summary: { content: "<p>官方公布新的发售安排。</p>" }, published: 1785200000 },
    { id: "2", title: "某游戏公布发售日期", canonical: [{ href: "https://example.com/b" }], summary: { content: "相同事件的补充来源" }, published: 1785200000 },
    { id: "3", title: "Studio announces launch date", canonical: [{ href: "https://example.com/c" }], summary: { content: "Official release information." }, published: 1785200000 },
  ], 100);
  assert.equal(items.length, 3);
  assert.equal(items[0].status, "review");
  assert.equal(items[1].status, "duplicate");
  assert.equal(items[2].status, "translation_required");
});

test("Inoreader 公共 JSON Feed 的 url、content_html 和 date_published 可正常解析", async () => {
  const items = await prepareFeedItems([{
    id: "json-feed-1",
    url: "https://example.com/news/story",
    title: "New game announces release date",
    content_html: "<p>The studio confirmed the release window.</p>",
    date_published: "2026-07-28T01:00:00Z",
  }], 100);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://example.com/news/story");
  assert.equal(items[0].summary, "The studio confirmed the release window.");
  assert.equal(items[0].publishedAt, "2026-07-28T01:00:00.000Z");
  assert.equal(items[0].status, "translation_required");
});

test("Inoreader 请求固定读取最多 100 条并保留其他参数", () => {
  const url = feedUrlWithLimit("https://www.inoreader.com/stream/user/example/tag/news/view/json?foo=bar", 100);
  assert.equal(new URL(url).searchParams.get("n"), "100");
  assert.equal(new URL(url).searchParams.get("foo"), "bar");
  assert.equal(feedUrlWithLimit("https://example.com/feed.json", 100), "https://example.com/feed.json");
});

test("RSS 入库结果区分新条目与数据库已存在条目", async () => {
  const route = await readFile(new URL("../app/api/automation/ingest/route.ts", import.meta.url), "utf8");
  const button = await readFile(new URL("../components/IngestButton.tsx", import.meta.url), "utf8");
  assert.match(route, /alreadyStored/);
  assert.match(route, /newestPublishedAt/);
  assert.match(button, /没有新条目/);
  assert.match(button, /已存在/);
});

test("外文 RSS 线索可以生成待翻译、待审核草稿", async () => {
  const route = await readFile(new URL("../app/api/admin/feed/[id]/draft/route.ts", import.meta.url), "utf8");
  const queue = await readFile(new URL("../app/admin/feed/page.tsx", import.meta.url), "utf8");
  assert.match(route, /\["review", "translation_required"\]/);
  assert.match(route, /需要人工翻译/);
  assert.match(queue, /生成待人工编辑的草稿/);
  assert.match(queue, /needsTranslation/);
});

test("封面文件标识仅允许本站 covers 对象且生成安全公开地址", () => {
  const key = "covers/2026/07/2d37f302-70d2-43c3-a3e1-b35a499ab014.webp";
  assert.equal(safeCoverKey(key), key);
  assert.equal(mediaUrl(key), `/media/${key}`);
  assert.equal(safeCoverKey("../secret.env"), "");
  assert.equal(safeCoverKey("covers/2026/07/picture.svg"), "");
});

test("封面上传受管理员、类型、大小和版权字段保护", async () => {
  const upload = await readFile(new URL("../app/api/admin/media/route.ts", import.meta.url), "utf8");
  const create = await readFile(new URL("../app/api/admin/articles/route.ts", import.meta.url), "utf8");
  const update = await readFile(new URL("../app/api/admin/articles/[id]/route.ts", import.meta.url), "utf8");
  assert.match(upload, /getAdminUser/);
  assert.match(upload, /5 \* 1024 \* 1024/);
  assert.match(upload, /image\/jpeg/);
  assert.match(upload, /env\.MEDIA\.put/);
  for (const source of [create, update]) {
    assert.match(source, /cover_object_key/);
    assert.match(source, /coverCopyright/);
    assert.match(source, /使用封面时必须填写图片来源和版权\/授权说明/);
  }
});

test("管理员邮箱白名单会规范化大小写和空格", () => {
  assert.equal(normalizeEmail(" Admin@Example.COM "), "admin@example.com");
  assert.equal(isAllowedAdminEmail(" ADMIN@example.com ", "owner@example.com, admin@example.com"), true);
  assert.equal(isAllowedAdminEmail("other@example.com", "owner@example.com, admin@example.com"), false);
});

test("后台登录回跳地址只能留在管理区", () => {
  assert.equal(safeAdminReturnTo("/admin/articles?status=review"), "/admin/articles?status=review");
  assert.equal(safeAdminReturnTo("https://evil.example/admin"), "/admin");
  assert.equal(safeAdminReturnTo("//evil.example/admin"), "/admin");
  assert.equal(safeAdminReturnTo("/admin/login?return_to=/admin"), "/admin");
});

test("验证码和会话使用带密钥的哈希比较", async () => {
  const first = await hashAuthValue("a-secure-session-secret-that-is-long", "code:a@example.com:123456");
  const second = await hashAuthValue("a-secure-session-secret-that-is-long", "code:a@example.com:123456");
  const other = await hashAuthValue("a-secure-session-secret-that-is-long", "code:a@example.com:654321");
  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.equal(constantTimeEqual(first, second), true);
  assert.equal(constantTimeEqual(first, other), false);
});

test("独立管理员登录包含限流、短期验证码和安全 Cookie", async () => {
  const requestRoute = await readFile(new URL("../app/api/admin/auth/request-code/route.ts", import.meta.url), "utf8");
  const verifyRoute = await readFile(new URL("../app/api/admin/auth/verify-code/route.ts", import.meta.url), "utf8");
  assert.match(requestRoute, /created_at > unixepoch\(\) - 600/);
  assert.match(requestRoute, /unixepoch\(\) \+ 600/);
  assert.match(requestRoute, />= 3/);
  assert.match(requestRoute, />= 10/);
  assert.doesNotMatch(requestRoute, /console\.(log|info|debug)\s*\(/);
  assert.match(verifyRoute, /attempts < 5/);
  assert.match(verifyRoute, /httpOnly: true/);
  assert.match(verifyRoute, /sameSite: "lax"/);
  assert.match(verifyRoute, /secure: true/);
});

test("首页、搜索、RSS 与 sitemap 读取数据库已发布文章", async () => {
  const files = await Promise.all([
    "../app/page.tsx",
    "../app/search/page.tsx",
    "../app/rss.xml/route.ts",
    "../app/sitemap.ts",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  for (const source of files) assert.match(source, /getVisibleArticles/);
  assert.doesNotMatch(files[0], /articles\.slice/);
});
