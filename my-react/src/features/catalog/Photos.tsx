import { ImagePlus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { photoUrl } from "../../shared/assets";
import { useLanguage } from "../../shared/runtime";
import { catalogApi } from "./api";
import "./photos.css";

import { Resource, useResource } from "../../shared/resource";
import type { Definition } from "../../shared/types";
import { Button, ErrorNotice, Modal } from "../../shared/ui";
export function PhotoField({
  definition,
  slot = "activity-photo",
  value,
  fallback,
  label,
  onChange,
  onBusy,
}: {
  definition: Definition;
  slot?: string;
  value?: number | null;
  fallback?: string;
  label: string;
  onChange: (id: number | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useLanguage(),
    input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [library, setLibrary] = useState(false),
    [page, setPage] = useState(0);
  const slots = useResource(["image-slots", definition.id], () =>
    catalogApi.slots(definition.id),
  );
  const declared = definition.configurationSchema?.["x-image-slots"]?.[slot];
  const policy = slots.data?.find((item) => item.key === slot) ?? declared;
  const allowed = policy?.allowUpload === true;
  const accepted = policy?.acceptedContentTypes ?? [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
    ],
    limit = policy?.maxUploadBytes ?? 10 * 1024 * 1024;
  async function upload(file: File) {
    if (busy || !allowed) return;
    if (!accepted.includes(file.type) || file.size > limit) {
      setError(
        new Error(t("Choose a JPG, PNG, WebP or GIF image up to 10 MB.")),
      );
      return;
    }
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      onChange((await catalogApi.upload(definition.id, slot, file)).id);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      onBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <section className="activityPhotoField" aria-label={label}>
      <strong>{label}</strong>
      <div
        className="photo-drop"
        onDragOver={(e) => {
          if (allowed) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) void upload(file);
        }}
      >
        {photoUrl(value, fallback) ? (
          <img
            className="photoFieldPreview"
            src={photoUrl(value, fallback)}
            alt={label}
          />
        ) : (
          <ImagePlus size={28} />
        )}
        <small className="muted">{t("photo.description")}</small>
      </div>
      <ErrorNotice error={error} />
      <input
        ref={input}
        type="file"
        accept={accepted.join(",")}
        aria-label={t("Upload photo")}
        className="visually-hidden"
        disabled={busy || !allowed}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <div className="photoFieldActions actions">
        <Button
          disabled={!allowed}
          busy={busy}
          aria-label={t(value ? "Replace photo" : "Upload photo")}
          onClick={() => input.current?.click()}
        >
          <Upload size={15} />
          {t(value ? "Replace photo" : "Upload photo")}
        </Button>
        <Button
          disabled={busy || !allowed}
          onClick={() => {
            setPage(0);
            setLibrary(true);
          }}
        >
          {t("My photos")}
        </Button>
        {value && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => onChange(null)}
          >
            <X size={15} />
            {t("Remove photo")}
          </Button>
        )}
      </div>
      <Modal
        open={library}
        onClose={() => setLibrary(false)}
        title={t("My photos")}
      >
        {library && (
          <PhotoLibrary
            page={page}
            onPage={setPage}
            onSelect={(id) => {
              onChange(id);
              setLibrary(false);
            }}
          />
        )}
      </Modal>
    </section>
  );
}
function PhotoLibrary({
  page,
  onPage,
  onSelect,
}: {
  page: number;
  onPage: (page: number) => void;
  onSelect: (id: number) => void;
}) {
  const { t } = useLanguage();
  const query = useResource(["images", page], () => catalogApi.images(page));
  return (
    <Resource query={query}>
      {(data) => (
        <>
          <div className="photo-library">
            {data.items.map((asset) => (
              <button
                key={asset.id}
                className="photo-choice"
                onClick={() => onSelect(asset.id)}
                aria-label={asset.originalFilename}
              >
                <img src={asset.url} alt={asset.originalFilename} />
                <span>{asset.originalFilename}</span>
              </button>
            ))}
          </div>
          {!data.items.length && (
            <p>{t("Upload your first photo to use it again here.")}</p>
          )}
          <div className="actions">
            <Button disabled={page === 0} onClick={() => onPage(page - 1)}>
              {t("photo.previous")}
            </Button>
            <Button
              disabled={(page + 1) * 20 >= data.totalElements}
              onClick={() => onPage(page + 1)}
            >
              {t("photo.next")}
            </Button>
          </div>
        </>
      )}
    </Resource>
  );
}
