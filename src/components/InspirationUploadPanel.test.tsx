import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InspirationUploadPanel } from "./InspirationUploadPanel";

vi.mock("../api/materialLibraryApi", () => ({ listMaterialLibraryAssets: vi.fn().mockResolvedValue([]) }));

describe("InspirationUploadPanel", () => {
  it("uses exactly two explicit image roles", async () => {
    const user = userEvent.setup();
    const onInspirationChange = vi.fn();
    const onReplacementChange = vi.fn();
    render(<InspirationUploadPanel inspiration={null} onInspirationChange={onInspirationChange} onReplacementChange={onReplacementChange} />);

    await user.upload(screen.getByLabelText("上传灵感原图"), new File(["base"], "base.jpg", { type: "image/jpeg" }));
    await user.upload(screen.getByLabelText("上传产品服装图"), new File(["shirt"], "shirt.jpg", { type: "image/jpeg" }));

    expect(onInspirationChange).toHaveBeenCalledOnce();
    expect(onReplacementChange).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Image 3/)).not.toBeInTheDocument();
  });
});
