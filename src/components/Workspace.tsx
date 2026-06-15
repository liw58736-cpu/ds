import { useEffect, useRef, useState } from "react";
import { defaultConfig } from "../domain/defaults";
import type { GenerationConfig, GenerationModule, ProductInput } from "../domain/types";
import { ModuleNav } from "./ModuleNav";
import { ParameterPanel } from "./ParameterPanel";
import { ResultPreview } from "./ResultPreview";
import { UploadPanel } from "./UploadPanel";

export function Workspace() {
  const [config, setConfig] = useState<GenerationConfig>(defaultConfig);
  const [product, setProduct] = useState<ProductInput | null>(null);
  const productRef = useRef<ProductInput | null>(null);

  const revokeUploadedProduct = (productToRevoke: ProductInput | null) => {
    if (productToRevoke?.source === "upload") {
      URL.revokeObjectURL(productToRevoke.imageUrl);
    }
  };

  const handleModuleSelect = (module: GenerationModule) => {
    setConfig((currentConfig) => ({ ...currentConfig, module }));
  };

  const handleProductChange = (nextProduct: ProductInput) => {
    const previousProduct = productRef.current;

    if (previousProduct?.imageUrl !== nextProduct.imageUrl) {
      revokeUploadedProduct(previousProduct);
    }

    productRef.current = nextProduct;
    setProduct(nextProduct);
  };

  useEffect(() => {
    return () => {
      revokeUploadedProduct(productRef.current);
    };
  }, []);

  return (
    <main className="workspace">
      <ModuleNav selectedModule={config.module} onSelect={handleModuleSelect} />
      <div className="workspace-main">
        <UploadPanel product={product} onProductChange={handleProductChange} />
        <ResultPreview product={product} />
      </div>
      <ParameterPanel config={config} onChange={setConfig} />
    </main>
  );
}
