import {describe,it,expect} from "vitest";
import {prayerDisclosure, PrayerVisibility} from "../../src/features/prayer-requests/visibility";

describe("independent prayer disclosure and anonymity",()=>{
  it.each([
    ["private",false,"private"], ["private",true,"private_anonymous"],
    ["public",false,"public"], ["public",true,"anonymous"],
  ] as const)("encodes %s with anonymous=%s as %s",(scope,anonymous,expected)=>{
    expect(prayerDisclosure(scope,anonymous)).toBe(expected);
    expect(PrayerVisibility.parse(expected)).toBe(expected);
  });
});
