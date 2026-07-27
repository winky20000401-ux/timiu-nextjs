import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("首页可服务端渲染并包含完整品牌与导航", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html lang="zh-CN"/);
  assert.match(html, /TIMIU 游戏资讯/);
  assert.match(html, /读懂游戏/);
  assert.match(html, /游戏新闻/);
  assert.match(html, /科技硬件/);
  assert.match(html, /游戏攻略/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("后台入口使用完整页面导航以交给平台处理登录", async () => {
  const source = await readFile(new URL("../components/SiteChrome.tsx", import.meta.url), "utf8");
  assert.match(source, /<a href="\/admin">编辑工作台<\/a>/);
  assert.doesNotMatch(source, /<Link href="\/admin">编辑工作台<\/Link>/);
});

test("栏目、搜索、文章和静态页面可渲染", async () => {
  for (const [path, expected] of [
    ["/news", "游戏新闻"],
    ["/hardware", "科技硬件"],
    ["/guides", "游戏攻略"],
    ["/search?q=PC", "搜索文章"],
    ["/article/how-timiu-reports-game-news", "消息来源"],
    ["/about", "关于 TIMIU"],
    ["/privacy", "隐私政策"],
  ]) {
    const response = await render(path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), new RegExp(expected), path);
  }
});

test("RSS 与 robots 输出正确", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("assets", `${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const rss = await worker.fetch(new Request("http://localhost/rss.xml"), env, ctx);
  assert.equal(rss.status, 200);
  assert.match(rss.headers.get("content-type") ?? "", /application\/rss\+xml/);
  assert.match(await rss.text(), /<rss version="2.0">/);
  const robots = await worker.fetch(new Request("http://localhost/robots.txt"), env, ctx);
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Sitemap: https:\/\/timiu.com\/sitemap.xml/);
});
