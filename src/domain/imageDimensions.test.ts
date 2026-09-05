import { expect, it } from "vitest";
import { fitImageToResolution } from "./imageDimensions";
it("preserves portrait and landscape aspect ratios instead of forcing a square", () => {
  expect(fitImageToResolution(800, 1600, "2K")).toBe("1024x2048");
  expect(fitImageToResolution(1600, 800, "4K")).toBe("4096x2048");
});
