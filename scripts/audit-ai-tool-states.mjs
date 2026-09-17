import { chromium } from "@playwright/test";

const baseUrl = process.env.KROMA_AUDIT_URL || "http://127.0.0.1:4291";
const modes = [
  "白底图",
  "幽灵模特",
  "AI背景",
  "精修",
  "换装",
  "换模特",
  "局部清理",
  "移除物体",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1516, height: 1066 } });
await page.goto(`${baseUrl}/#/white_background`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "使用示例商品" }).click();

const report = [];
for (const mode of modes) {
  const button = page
    .locator('.segmented-control[aria-label="AI工具"]')
    .getByRole("button", { name: mode, exact: true });
  await button.click();
  await page.waitForTimeout(80);
  const audit = await page.evaluate(() => {
    const parse = (value) => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const values = match[1].split(/[,/ ]+/).filter(Boolean).map(Number);
      return { r: values[0], g: values[1], b: values[2], a: values[3] ?? 1 };
    };
    const blend = (front, back) => ({
      r: front.r * front.a + back.r * (1 - front.a),
      g: front.g * front.a + back.g * (1 - front.a),
      b: front.b * front.a + back.b * (1 - front.a),
      a: 1,
    });
    const backgroundFor = (element) => {
      let result = { r: 9, g: 11, b: 16, a: 1 };
      const layers = [];
      for (let node = element; node instanceof Element; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.backgroundImage !== "none") return null;
        const color = parse(style.backgroundColor);
        if (color && color.a > 0) layers.push(color);
      }
      for (let index = layers.length - 1; index >= 0; index -= 1) {
        result = blend(layers[index], result);
      }
      return result;
    };
    const channel = (value) => {
      const normalized = value / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const luminance = ({ r, g, b }) =>
      0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const contrast = (one, two) => {
      const first = luminance(one);
      const second = luminance(two);
      return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    };
    const selector = (element) => {
      const classes = [...element.classList].slice(0, 3).join(".");
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`;
    };
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
    };
    const contrastIssues = [...document.querySelectorAll("body *")]
      .filter((element) => {
        if (!visible(element) || ["SCRIPT", "STYLE", "SVG", "PATH", "IMG", "VIDEO"].includes(element.tagName)) return false;
        return [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
      })
      .flatMap((element) => {
        const style = getComputedStyle(element);
        const foreground = parse(style.color);
        const background = backgroundFor(element);
        if (!foreground || !background) return [];
        const ratio = contrast(blend(foreground, background), background);
        const fontSize = Number.parseFloat(style.fontSize);
        const large = fontSize >= 24 || (Number.parseInt(style.fontWeight, 10) >= 700 && fontSize >= 18.66);
        if (ratio >= (large ? 3 : 4.5)) return [];
        return [{ selector: selector(element), text: element.textContent?.trim().slice(0, 80), ratio: Number(ratio.toFixed(2)), foreground: style.color, background: style.backgroundColor }];
      });
    const lightSurfaces = [...document.querySelectorAll("body *")]
      .flatMap((element) => {
        if (!visible(element) || ["IMG", "VIDEO", "CANVAS"].includes(element.tagName)) return [];
        const rect = element.getBoundingClientRect();
        if (rect.width * rect.height < 1200) return [];
        const color = parse(getComputedStyle(element).backgroundColor);
        if (!color || color.a < 0.9 || Math.min(color.r, color.g, color.b) < 205) return [];
        return [{ selector: selector(element), color: getComputedStyle(element).backgroundColor }];
      });
    return { contrastIssues, lightSurfaces, welcomeText: document.body.innerText.includes("欢迎来到") };
  });
  const slug = mode.replace(/[^\p{L}\p{N}]+/gu, "-");
  await page.screenshot({
    path: `output/ai-tool-state-${slug}.png`,
    fullPage: false,
  });
  report.push({ mode, ...audit });
  if (["局部清理", "移除物体"].includes(mode)) {
    await page.getByRole("button", { name: "返回 AI 工具" }).click();
  }
}

console.log(JSON.stringify(report, null, 2));
await browser.close();
