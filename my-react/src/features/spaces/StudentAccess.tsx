import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Brand } from "../../shared/Brand";
import { useLanguage, useSpace } from "../../shared/runtime";
import type { AccessCard, SpaceStudent } from "../../shared/types";
import { Button, ErrorNotice, Loading, Modal } from "../../shared/ui";

import { spacesApi } from "./api";
export function LoginCard({ card }: { card: AccessCard }) {
  const { t } = useLanguage(),
    [qr, setQr] = useState("");
  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(
      window.location.origin +
        "/#student-code=" +
        encodeURIComponent(card.code),
      { width: 160, margin: 1 },
    ).then((value) => {
      if (!cancelled) setQr(value);
    });
    return () => {
      cancelled = true;
    };
  }, [card.code]);
  return (
    <article className="student-login-card">
      <Brand />
      <h2>{card.name}</h2>
      {qr && (
        <img src={qr} width={160} height={160} alt={t("Scan to sign in")} />
      )}
      <strong className="student-login-code">{card.code}</strong>
      <p>{t("Your private PlaySheets login. Use it for all your classes.")}</p>
    </article>
  );
}
export function StudentAccess({
  student,
  onClose,
}: {
  student: SpaceStudent;
  onClose: () => void;
}) {
  const { context } = useSpace(),
    { t } = useLanguage(),
    [card, setCard] = useState<AccessCard | null>(null),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void spacesApi
      .credential(context!.spaceId!, student.id)
      .then((c) => {
        if (active) setCard(c);
      })
      .catch((e) => {
        if (active) setError(e);
      });
    return () => {
      active = false;
    };
  }, [context, student.id]);
  async function reset() {
    setBusy(true);
    setError(null);
    try {
      setCard(await spacesApi.credential(context!.spaceId!, student.id, true));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open title={t("Student login card")} onClose={onClose}>
      <ErrorNotice error={error} />
      {!card && !error && <Loading />}
      {card && (
        <>
          <div className="print-card-area">
            <LoginCard card={card} />
          </div>
          <div className="actions">
            <Button variant="primary" onClick={() => window.print()}>
              {t("Print card")}
            </Button>
            <Button
              busy={busy}
              onClick={() => {
                if (
                  window.confirm(
                    t(
                      "Replace this login code? Existing cards and sessions will stop working.",
                    ),
                  )
                )
                  void reset();
              }}
            >
              {t("Replace login code")}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
