import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, X } from "lucide-react";

interface NoticeDialogProps {
  open: boolean;
  title: string;
  message: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  onClose: () => void;
}

export function NoticeDialog({
  open,
  title,
  message,
  primaryLabel = "我知道了",
  onPrimary,
  secondaryLabel,
  onSecondary,
  onClose,
}: NoticeDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    primaryButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const runPrimary = () => {
    onClose();
    onPrimary?.();
  };
  const runSecondary = () => {
    onClose();
    onSecondary?.();
  };

  return createPortal(
    <div className="notice-dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="notice-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="notice-dialog-close"
          aria-label="关闭提示"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
        <div className="notice-dialog-icon"><AlertCircle aria-hidden="true" /></div>
        <div className="notice-dialog-copy">
          <h2 id={titleId}>{title}</h2>
          <p id={messageId}>{message}</p>
        </div>
        <div className="notice-dialog-actions">
          {secondaryLabel ? (
            <button type="button" className="secondary-button" onClick={runSecondary}>
              {secondaryLabel}
            </button>
          ) : null}
          <button
            ref={primaryButtonRef}
            type="button"
            className="primary-button"
            onClick={runPrimary}
          >
            {primaryLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
