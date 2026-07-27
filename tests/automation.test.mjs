import assert from "node:assert/strict";
import test from "node:test";
import { canAutoPublish, hasVersionConflict, titleSimilarity } from "../lib/automation.ts";

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
