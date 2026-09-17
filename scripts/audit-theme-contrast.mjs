import { chromium } from "@playwright/test";

const baseUrl = process.env.KROMA_AUDIT_URL || "http://127.0.0.1:4290";
const routes = [
  "home",
  "main_image",
  "detail_page",
  "white_background",
  "inspiration",
  "motion",
  "materials",
  "history",
  "pricing",
  "account",
  "login",
  "terms",
  "privacy",
  "refund",
  "credits",
  "support",
  "about",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1516, height: 1066 } });
await page.addInitScript(() => {
  localStorage.setItem(
    "commerce-studio-account-v1",
    JSON.stringify({
      balance: 100,
      transactions: [],
      session: {
        identifier: "visual@example.com",
        authView: "login",
        mode: "password",
        storeName: "",
        inviteCode: "",
        createdAt: "2026-09-09T00:00:00Z",
      },
    }),
  );
});

const reports = [];
for (const route of routes) {
  await page.goto(route === "home" ? baseUrl : `${baseUrl}/#/${route}`, {
    waitUntil: "networkidle",
  });
  const issues = await page.evaluate(() => {
    const parseColor = (value) => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(/[,/ ]+/).filter(Boolean).map(Number);
      return {
        r: parts[0],
        g: parts[1],
        b: parts[2],
        a: Number.isFinite(parts[3]) ? parts[3] : 1,
      };
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
        const parsed = parseColor(style.backgroundColor);
        if (parsed && parsed.a > 0) layers.push(parsed);
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
      if (element.id) return `#${element.id}`;
      const parts = [];
      for (let node = element; node && parts.length < 4; node = node.parentElement) {
        let part = node.tagName.toLowerCase();
        if (node.classList.length) part += `.${[...node.classList].slice(0, 2).join(".")}`;
        parts.unshift(part);
      }
      return parts.join(" > ");
    };

    return [...document.querySelectorAll("body *")]
      .filter((element) => {
        if (["SCRIPT", "STYLE", "SVG", "PATH", "IMG", "VIDEO"].includes(element.tagName)) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (rect.width < 2 || rect.height < 2 || style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
        return [...element.childNodes].some(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        );
      })
      .flatMap((element) => {
        const text = [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent?.trim())
          .filter(Boolean)
          .join(" ");
        const style = getComputedStyle(element);
        const color = parseColor(style.color);
        const background = backgroundFor(element);
        if (!color || !background) return [];
        const ratio = contrast(blend(color, background), background);
        const fontSize = Number.parseFloat(style.fontSize);
        const bold = Number.parseInt(style.fontWeight, 10) >= 700;
        const large = fontSize >= 24 || (bold && fontSize >= 18.66);
        const required = large ? 3 : 4.5;
        if (ratio >= required) return [];
        return [
          {
            selector: selector(element),
            text: text.slice(0, 90),
            foreground: style.color,
            background: `rgb(${Math.round(background.r)}, ${Math.round(background.g)}, ${Math.round(background.b)})`,
            ratio: Number(ratio.toFixed(2)),
            required,
          },
        ];
      })
      .slice(0, 80);
  });
  const lightSurfaces = await page.evaluate(() => {
    const parse = (value) => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const values = match[1].split(/[,/ ]+/).filter(Boolean).map(Number);
      return { r: values[0], g: values[1], b: values[2], a: values[3] ?? 1 };
    };
    const selector = (element) => {
      if (element.id) return `#${element.id}`;
      const classes = [...element.classList].slice(0, 3).join(".");
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""}`;
    };
    return [...document.querySelectorAll("body *")]
      .flatMap((element) => {
        if (["IMG", "VIDEO", "CANVAS"].includes(element.tagName)) return [];
        const rect = element.getBoundingClientRect();
        if (rect.width * rect.height < 1200 || rect.bottom <= 0 || rect.top >= innerHeight) return [];
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return [];
        const color = parse(style.backgroundColor);
        if (!color || color.a < 0.9 || Math.min(color.r, color.g, color.b) < 205) return [];
        return [{ selector: selector(element), background: style.backgroundColor, area: Math.round(rect.width * rect.height) }];
      })
      .slice(0, 40);
  });
  reports.push({ route, count: issues.length, issues, lightSurfaces });
}

const grouped = reports.map(({ route, issues }) => {
  const bySelector = new Map();
  for (const issue of issues) {
    const existing = bySelector.get(issue.selector);
    if (!existing || issue.ratio < existing.ratio) {
      bySelector.set(issue.selector, { ...issue, occurrences: 1 });
    } else {
      existing.occurrences += 1;
    }
  }
  return {
    route,
    count: issues.length,
    groups: [...bySelector.values()].sort((a, b) => a.ratio - b.ratio),
    lightSurfaces: reports.find((report) => report.route === route)?.lightSurfaces ?? [],
  };
});
console.log(JSON.stringify(grouped, null, 2));
await browser.close();
