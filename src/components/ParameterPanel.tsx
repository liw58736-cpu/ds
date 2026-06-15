import { moduleLabels } from "../domain/defaults";
import type {
  AspectRatio,
  GenerationConfig,
  OutputFormat,
  Platform,
  VisualStyle,
} from "../domain/types";

interface ParameterPanelProps {
  config: GenerationConfig;
  onChange: (config: GenerationConfig) => void;
}

const platformOptions: Array<{ value: Platform; label: string }> = [
  { value: "amazon", label: "Amazon" },
  { value: "shopify", label: "Shopify" },
  { value: "independent_store", label: "独立站" },
];

const aspectRatioOptions: Array<{ value: AspectRatio; label: string }> = [
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
  { value: "16:9", label: "16:9" },
  { value: "long_page", label: "详情长图" },
];

const styleOptions: Array<{ value: VisualStyle; label: string }> = [
  { value: "studio", label: "棚拍质感" },
  { value: "lifestyle", label: "生活方式" },
  { value: "premium", label: "高端品牌" },
  { value: "minimal", label: "极简陈列" },
];

const outputFormatOptions: Array<{ value: OutputFormat; label: string }> = [
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "webp", label: "WebP" },
];

export function ParameterPanel({ config, onChange }: ParameterPanelProps) {
  const updateConfig = <Key extends keyof GenerationConfig>(
    key: Key,
    value: GenerationConfig[Key],
  ) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <aside className="panel parameter-panel" aria-labelledby="parameters-title">
      <div className="panel-heading">
        <p className="eyebrow">Settings</p>
        <h2 id="parameters-title">参数</h2>
      </div>

      <div className="field">
        <label htmlFor="module-label">模块</label>
        <input
          id="module-label"
          value={moduleLabels[config.module]}
          readOnly
          aria-readonly="true"
        />
      </div>

      <div className="field">
        <label htmlFor="platform">平台</label>
        <select
          id="platform"
          value={config.platform}
          onChange={(event) =>
            updateConfig("platform", event.target.value as Platform)
          }
        >
          {platformOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="aspect-ratio">尺寸</label>
        <select
          id="aspect-ratio"
          value={config.aspectRatio}
          onChange={(event) =>
            updateConfig("aspectRatio", event.target.value as AspectRatio)
          }
        >
          {aspectRatioOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="style">风格</label>
        <select
          id="style"
          value={config.style}
          onChange={(event) =>
            updateConfig("style", event.target.value as VisualStyle)
          }
        >
          {styleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="output-format">输出格式</label>
        <select
          id="output-format"
          value={config.outputFormat}
          onChange={(event) =>
            updateConfig("outputFormat", event.target.value as OutputFormat)
          }
        >
          {outputFormatOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="selling-points">卖点</label>
        <textarea
          id="selling-points"
          value={config.sellingPoints}
          rows={4}
          onChange={(event) => updateConfig("sellingPoints", event.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="specifications">规格</label>
        <textarea
          id="specifications"
          value={config.specifications}
          rows={4}
          onChange={(event) =>
            updateConfig("specifications", event.target.value)
          }
        />
      </div>
    </aside>
  );
}
