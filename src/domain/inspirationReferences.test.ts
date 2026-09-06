import { describe, expect, it } from "vitest";
import type { GenerationConfig } from "./types";
import {
  buildInspirationReferenceRoleContract,
  getActiveInspirationReferenceDefinitions,
  getMissingInspirationReference,
  getOrderedInspirationReferenceAssets,
} from "./inspirationReferences";

const config: GenerationConfig = {
  module: "lifestyle",
  platform: "shopify",
  aspectRatio: "4:5",
  style: "lifestyle",
  outputFormat: "png",
  sellingPoints: "",
  specifications: "",
  inspirationSettings: {
    background: "studio",
    pose: "natural",
    model: "female",
    composition: "hero",
    purpose: "social_post",
    productHandling: "preserve",
    backgroundAction: "keep",
    poseAction: "replace",
    modelAction: "replace",
    productAction: "replace",
  },
  moduleReferenceAssets: {
    inspiration_pose: [
      { id: "pose", fileName: "pose.png", imageUrl: "https://cdn.test/pose.png" },
    ],
    inspiration_model: [
      { id: "model", fileName: "model.png", imageUrl: "https://cdn.test/model.png" },
    ],
    inspiration_product: [
      { id: "product", fileName: "product.png", imageUrl: "https://cdn.test/product.png" },
    ],
  },
};

describe("inspiration replacement reference roles", () => {
  it("activates only controls set to replace and preserves role order", () => {
    expect(
      getActiveInspirationReferenceDefinitions(config).map(({ key }) => key),
    ).toEqual([
      "inspiration_pose",
      "inspiration_model",
      "inspiration_product",
    ]);
    expect(
      getOrderedInspirationReferenceAssets(config).map(
        ({ definition, imageNumber }) => [definition.key, imageNumber],
      ),
    ).toEqual([
      ["inspiration_pose", 2],
      ["inspiration_model", 3],
      ["inspiration_product", 4],
    ]);
  });

  it("identifies the first missing replacement image", () => {
    const missingPose: GenerationConfig = {
      ...config,
      moduleReferenceAssets: {
        ...config.moduleReferenceAssets,
        inspiration_pose: [],
      },
    };

    expect(getMissingInspirationReference(missingPose)?.key).toBe(
      "inspiration_pose",
    );
    expect(getMissingInspirationReference(config)).toBeNull();
  });

  it("writes a provider-readable contract for every image role", () => {
    const contract = buildInspirationReferenceRoleContract(config);

    expect(contract).toContain("Image 1 is the base inspiration photo");
    expect(contract).toContain("Image 2 is the target pose reference");
    expect(contract).toContain("Image 3 is the target model identity reference");
    expect(contract).toContain("Image 4 is the replacement product or clothing source");
  });
});
