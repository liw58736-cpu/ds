import { moduleLabels } from "../domain/defaults";
import type { GenerationModule } from "../domain/types";

interface ModuleNavProps {
  selectedModule: GenerationModule;
  onSelect: (module: GenerationModule) => void;
}

const modules = Object.keys(moduleLabels) as GenerationModule[];

export function ModuleNav({ selectedModule, onSelect }: ModuleNavProps) {
  return (
    <aside className="panel module-panel" aria-label="模块导航">
      <div className="panel-heading">
        <p className="eyebrow">Modules</p>
        <h2>生成模块</h2>
      </div>
      <div className="module-list">
        {modules.map((module) => {
          const isActive = module === selectedModule;

          return (
            <button
              type="button"
              key={module}
              className={`module-button${isActive ? " is-active" : ""}`}
              aria-pressed={isActive}
              onClick={() => onSelect(module)}
            >
              {moduleLabels[module]}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
