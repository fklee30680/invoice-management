import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hexToRgb,
  isValidRgbValue,
  normalizeHex,
  rgbToHex,
} from "./color-utils";

describe("color utilities", () => {
  it("normalizes six-character hex values with or without #", () => {
    assert.equal(normalizeHex("#0f766e"), "#0f766e");
    assert.equal(normalizeHex("0F766E"), "#0f766e");
  });

  it("expands shorthand hex values", () => {
    assert.equal(normalizeHex("#FFF"), "#ffffff");
    assert.equal(normalizeHex("0aF"), "#00aaff");
  });

  it("rejects invalid hex values", () => {
    assert.equal(normalizeHex(""), null);
    assert.equal(normalizeHex("#12"), null);
    assert.equal(normalizeHex("#nothex"), null);
  });

  it("converts hex to rgb", () => {
    assert.deepEqual(hexToRgb("#0f766e"), { r: 15, g: 118, b: 110 });
  });

  it("converts rgb to hex", () => {
    assert.equal(rgbToHex({ r: 15, g: 118, b: 110 }), "#0f766e");
  });

  it("rejects invalid rgb values", () => {
    assert.equal(rgbToHex({ r: -1, g: 118, b: 110 }), null);
    assert.equal(rgbToHex({ r: 15, g: 256, b: 110 }), null);
    assert.equal(isValidRgbValue(Number.NaN), false);
    assert.equal(isValidRgbValue(12.5), false);
  });
});
