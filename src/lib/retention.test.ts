import { describe, it, expect } from "vitest";
import { RETENTION_OPTIONS, retentionWouldDelete } from "./retention";

describe("retentionWouldDelete", () => {
  it("counts what a smaller limit would cull", () => {
    expect(retentionWouldDelete(120, 50)).toBe(70);
    expect(retentionWouldDelete(101, 100)).toBe(1);
  });

  it("deletes nothing when the limit is not reached", () => {
    expect(retentionWouldDelete(40, 50)).toBe(0);
    expect(retentionWouldDelete(50, 50)).toBe(0);
  });

  it("deletes nothing when the limit goes up", () => {
    expect(retentionWouldDelete(100, 500)).toBe(0);
  });

  it("treats zero as keeping everything", () => {
    // Not as "keep none of them", which would read as culling the lot.
    expect(retentionWouldDelete(5000, 0)).toBe(0);
  });

  it("never reports a negative cull", () => {
    expect(retentionWouldDelete(0, 100)).toBe(0);
    expect(retentionWouldDelete(0, 0)).toBe(0);
  });

  it("is what decides whether the page stops to ask", () => {
    // The warning exists for the case where something goes. Raising the limit
    // must not raise a dialog, or the reader learns to dismiss it unread.
    const history = 200;
    const warns = (limit: number) => retentionWouldDelete(history, limit) > 0;

    expect(warns(50)).toBe(true);
    expect(warns(100)).toBe(true);
    expect(warns(250)).toBe(false);
    expect(warns(0)).toBe(false);
  });
});

describe("RETENTION_OPTIONS", () => {
  it("offers Everything, and only once", () => {
    const unlimited = RETENTION_OPTIONS.filter((o) => o.value === 0);
    expect(unlimited).toHaveLength(1);
  });

  it("has no duplicate values, since the dropdown keys on them", () => {
    const values = RETENTION_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("offers the default the Rust side uses", () => {
    // default_history_limit() is 100. An option missing here would leave the
    // dropdown showing nothing on a fresh install.
    expect(RETENTION_OPTIONS.some((o) => o.value === 100)).toBe(true);
  });
});
