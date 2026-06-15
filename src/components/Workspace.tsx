import { useState } from "react";
import { defaultConfig } from "../domain/defaults";
import type { GenerationConfig, GenerationModule, ProductInput } from "../domain/types";
import { ModuleNav } from "./ModuleNav";
import { ParameterPanel } from "./ParameterPanel";
import { ResultPreview } from "./ResultPreview";
import { UploadPanel } from "./UploadPanel";

export function Workspace() {
  const [config, setConfig] = useState<GenerationConfig>(defaultConfig);
  const [product, setProduct] = useState<ProductInput | null>(null);

  const handleModuleSelect = (module: GenerationModule) => {
    setConfig((currentConfig) => ({ ...currentConfig, module }));
  };

  return (
    <main className="workspace">
      <ModuleNav selectedModule={config.module} onSelect={handleModuleSelect} />
      <div className="workspace-main">
        <UploadPanel product={product} onProductChange={setProduct} />
        <ResultPreview product={product} />
      </div>
      <ParameterPanel config={config} onChange={setConfig} />
    </main>
  );
}
