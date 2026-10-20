import test from "node:test";
import assert from "node:assert/strict";
import { toPaise, money, dateTime, localDate } from "../src/utils/format.js";
import { validateSlug, suggestSlug } from "../../shared/slug.js";
test("rupee form input converts exactly to paise without floating-point rounding", () => {
  assert.equal(toPaise("0.29"), 29);
  assert.equal(toPaise("1999.99"), 199999);
  assert.equal(toPaise("10.1"), 1010);
  for (const bad of ["1.001", "-1", "NaN", "1e3", "", "9007199254740993"])
    assert.throws(() => toPaise(bad));
  assert.match(money(10050), /100.50/);
});
test("calendar dates and event times use the venue zone across UTC date boundaries", () => {
  assert.equal(localDate("2030-01-01T20:00:00Z", "Asia/Kolkata"), "2030-01-02");
  assert.match(dateTime("2030-01-01T20:00:00Z", "Asia/Kolkata"), /2 Jan/);
});
test("frontend slug suggestions share backend reserved-name and normalization rules", () => {
  assert.equal(suggestSlug("Royal Palace"), "royal-palace");
  assert.equal(validateSlug("api").valid, false);
  assert.equal(validateSlug("royal-palace").valid, true);
});
