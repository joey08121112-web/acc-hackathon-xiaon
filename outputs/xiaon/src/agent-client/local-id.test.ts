import test from "node:test";
import assert from "node:assert/strict";
import { localId, newOperationId } from "./index";

/**
 * 局域网用 http:// 访问时不是安全上下文，`crypto.randomUUID` 不存在。
 * 2026-11-21 实测：没有兜底时首次引导的第一次写请求就抛 TypeError，
 * 页面停在引导页提示「这次没有保存好，请连接后再试」，整个应用进不去。
 * 这条用例守住那个兜底，别让它被改版冲掉。
 */
test("crypto.randomUUID 不存在时也要能生成 id（局域网 http:// 访问）", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis.crypto, "randomUUID");
  Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined, configurable: true });
  try {
    const a = localId();
    const b = localId();
    assert.equal(typeof a, "string");
    assert.ok(a.length > 0, "兜底 id 不能是空串");
    assert.notEqual(a, b, "两次生成的 id 必须不同");
    assert.match(a, /^local-/);
    assert.match(b, /^local-/);
  } finally {
    if (original) Object.defineProperty(globalThis.crypto, "randomUUID", original);
    else delete (globalThis.crypto as { randomUUID?: unknown }).randomUUID;
  }
});

test("安全上下文里用 crypto.randomUUID", () => {
  const id = newOperationId();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-/);
});
