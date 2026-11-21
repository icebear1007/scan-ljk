import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Batal',
  destructive = false,
  confirmDisabled = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const nilai = dialog.returnValue;
    dialog.returnValue = '';

    if (nilai === 'confirm') {
      onConfirm();
    } else {
      onCancel();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClose={handleClose}
      className="m-auto w-[min(92dvw,26rem)] rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 id={titleId} className="text-lg font-bold text-slate-900">
            {title}
          </h2>
          <p id={descId} className="text-sm text-slate-700">
            {description}
          </p>
        </div>

        {children ? <div>{children}</div> : null}

        <form
          method="dialog"
          className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:justify-end"
        >
          <button
            type="submit"
            value="cancel"
            autoFocus
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-base font-bold text-slate-900 transition-colors hover:bg-slate-200 active:bg-slate-300 sm:flex-none"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            value="confirm"
            disabled={confirmDisabled}
            className={`inline-flex min-h-12 flex-1 items-center justify-center rounded-xl px-4 py-3 text-base font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-45 sm:flex-none ${
              destructive
                ? 'bg-red-700 hover:bg-red-800 active:bg-red-900'
                : 'bg-blue-900 hover:bg-blue-800 active:bg-blue-950'
            }`}
          >
            {confirmLabel}
          </button>
        </form>
      </div>
    </dialog>
  );
}
