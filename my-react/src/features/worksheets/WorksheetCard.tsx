import { Menu } from "@base-ui/react/menu";
import {
  ArrowRight,
  BookOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import { useId, useRef } from "react";
import { Link } from "react-router-dom";
import { gameModules } from "../../games/registry";
import { photoUrl } from "../../shared/assets";
import { useLanguage } from "../../shared/runtime";
import type { Worksheet, WorksheetItem } from "../../shared/types";
import { Button } from "../../shared/ui";
import { visualForEmoji } from "../../shared/visuals/catalog";
import {
  activityCount,
  worksheetDate,
  type WorksheetAction,
} from "./library-model";

function previewImage(item: WorksheetItem) {
  const animal = item.configuration?.animals?.[0];
  if (item.definition?.type === "color-game" && animal)
    return photoUrl(animal.imageAssetId, animal.img);
  const pair = item.configuration?.pairs?.[0];
  if (item.definition?.type === "matching-game" && pair)
    return photoUrl(pair.imageAssetId, visualForEmoji(pair.emoji)?.src);
}

export default function WorksheetCard({
  sheet,
  onShare,
  onManage,
}: {
  sheet: Worksheet;
  onShare: (id: number) => void;
  onManage: (action: WorksheetAction) => void;
}) {
  const { t, language } = useLanguage();
  const id = useId();
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const count = activityCount(sheet);
  const countText = t(count === 1 ? "{count} activity" : "{count} activities", {
    count,
  });
  const items = [...(sheet.items ?? [])].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const types = [
    ...new Set(
      items.map((item) =>
        t(
          gameModules[item.definition?.type ?? ""]?.titleKey ??
            "library.otherActivity",
        ),
      ),
    ),
  ];
  const date = worksheetDate(sheet);
  const firstType = items[0]?.definition?.type ?? "empty";
  return (
    <article className="worksheet-card library-card" data-accent={firstType}>
      <Link
        className="worksheetOpenButton library-card-link"
        to={"/teacher/" + sheet.id}
        aria-label={t("library.openNamed", { name: sheet.name })}
        aria-describedby={id + "-count " + id + "-summary"}
      >
        <div className="library-card-cover">
          <span
            className={
              "library-count" + (!count ? " library-count--empty" : "")
            }
            id={id + "-count"}
          >
            {countText}
          </span>
          <div className="library-preview-tiles" aria-hidden="true">
            {items.slice(0, 3).map((item) => {
              const image = previewImage(item);
              return (
                <span className="library-preview-tile" key={item.id}>
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      width="36"
                      height="36"
                      loading="lazy"
                    />
                  ) : (
                    (gameModules[item.definition?.type ?? ""]?.symbol ?? (
                      <BookOpen size={23} />
                    ))
                  )}
                </span>
              );
            })}
            {count > 3 && (
              <span className="library-preview-more">+{count - 3}</span>
            )}
            {!count && (
              <span className="library-preview-tile library-preview-tile--empty">
                <Plus size={26} />
              </span>
            )}
          </div>
        </div>
        <div className="library-card-body">
          <div className="worksheet-title">
            <h2 title={sheet.name}>{sheet.name}</h2>
          </div>
          <p className="library-card-content" id={id + "-summary"}>
            {count ? types.join(" · ") : t("library.emptyCard")}
          </p>
          <span className="library-open">
            {t(count ? "library.open" : "library.startBuilding")}
            <ArrowRight size={17} aria-hidden="true" />
          </span>
        </div>
      </Link>
      <footer className="library-card-footer">
        <span
          className="library-updated"
          title={
            date === null
              ? undefined
              : new Date(date).toLocaleString(
                  language === "ro" ? "ro-RO" : "en-GB",
                )
          }
        >
          {date === null ? (
            t("library.dateUnavailable")
          ) : (
            <time dateTime={new Date(date).toISOString()}>
              {t("library.updated", {
                date: new Intl.DateTimeFormat(
                  language === "ro" ? "ro-RO" : "en-GB",
                  { day: "numeric", month: "short", year: "numeric" },
                ).format(date),
              })}
            </time>
          )}
        </span>
        <div className="library-card-tools">
          <Button
            variant="ghost"
            disabled={!count}
            aria-label={t("Share worksheet") + ": " + sheet.name}
            title={t(count ? "Share worksheet" : "library.shareEmpty")}
            onClick={() => onShare(sheet.id)}
          >
            <Share2 size={17} aria-hidden="true" />
          </Button>
          <Menu.Root>
            <Menu.Trigger
              ref={menuTrigger}
              render={
                <Button
                  variant="ghost"
                  aria-label={t("library.moreNamed", { name: sheet.name })}
                />
              }
            >
              <MoreHorizontal size={20} aria-hidden="true" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner
                sideOffset={6}
                align="end"
                className="menu-positioner"
              >
                <Menu.Popup className="menu-popup library-menu">
                  <Menu.Item
                    className="menu-item"
                    onClick={() =>
                      onManage({
                        kind: "rename",
                        sheet,
                        returnFocus: menuTrigger.current,
                      })
                    }
                  >
                    <Pencil size={16} />
                    {t("library.rename")}
                  </Menu.Item>
                  <Menu.Item
                    className="menu-item library-menu-danger"
                    aria-label={t("Delete worksheet") + ": " + sheet.name}
                    onClick={() =>
                      onManage({
                        kind: "delete",
                        sheet,
                        returnFocus: menuTrigger.current,
                      })
                    }
                  >
                    <Trash2 size={16} />
                    {t("Delete worksheet")}
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </footer>
    </article>
  );
}
