import { request } from "../../shared/http";
import { invalidateResources } from "../../shared/query";
import type {
  Asset,
  AssetPage,
  Definition,
  Id,
  ImageSlot,
} from "../../shared/types";
export const catalogApi = {
  definitions: () => request<Definition[]>("/api/minigames"),
  slots: (id: Id) =>
    request<ImageSlot[]>("/api/minigames/" + id + "/image-slots"),
  images: (page = 0) =>
    request<AssetPage>("/api/minigame-assets?page=" + page + "&size=20"),
  upload: async (definition: Id, slot: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    const asset = await request<Asset>(
      "/api/minigames/" + definition + "/image-slots/" + slot + "/uploads",
      { method: "POST", body },
    );
    await invalidateResources(["images"]);
    return asset;
  },
};
