import { useState } from "react";
import { useLanguage } from "../../app/state";
import { api } from "../../shared/api";
import { Button, Empty, Modal } from "../../shared/ui";
import { Resource, useResource } from "../../shared/resource";
import { AssignDialog } from "../worksheets/Sharing";
export default function AssignmentLauncher({
  classroomId,
  onClose,
}: {
  classroomId?: string;
  onClose: () => void;
}) {
  const { t } = useLanguage(),
    [selected, setSelected] = useState<number | null>(null),
    [search, setSearch] = useState("");
  const query = useResource(["assign-worksheets"], api.worksheets);
  return selected === null ? (
    <Modal open title={t("Choose worksheet")} onClose={onClose}>
      <input
        aria-label={t("Search worksheets")}
        type="search"
        placeholder={t("Search worksheets")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Resource query={query}>
        {(sheets) => (
          <div className="class-worksheet-list">
            {sheets
              .filter((s) =>
                s.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
              )
              .map((s) => (
                <Button
                  key={s.id}
                  disabled={!s.items.length}
                  onClick={() => setSelected(s.id)}
                >
                  {s.name}
                  <span>{s.items.length}</span>
                </Button>
              ))}
            {!sheets.length && (
              <Empty
                description={t("Create a worksheet before assigning work.")}
              />
            )}
          </div>
        )}
      </Resource>
    </Modal>
  ) : (
    <AssignDialog
      worksheetId={selected}
      classroomId={classroomId}
      onClose={onClose}
    />
  );
}
