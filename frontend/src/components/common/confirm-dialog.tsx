import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  actionLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  children?: ReactNode;
}

/**
 * ConfirmDialog
 *
 * A reusable confirmation dialog component, commonly used for deletion confirmations.
 *
 * ## Usage
 *
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * return (
 *   <>
 *     <Button onClick={() => setOpen(true)}>Delete</Button>
 *
 *     <ConfirmDialog
 *       open={open}
 *       title="Delete user?"
 *       description="This action cannot be undone."
 *       actionLabel="Delete"
 *       variant="danger"
 *       onConfirm={async () => {
 *         await deleteUser();
 *         setOpen(false);
 *       }}
 *       onCancel={() => setOpen(false)}
 *     />
 *   </>
 * );
 * ```
 */
export function ConfirmDialog({
  open,
  title,
  description,
  actionLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const buttonVariant =
    variant === 'danger' ? 'destructive' : variant === 'warning' ? 'secondary' : 'default';
  const iconColor =
    variant === 'danger'
      ? 'text-destructive'
      : variant === 'warning'
        ? 'text-yellow-600'
        : 'text-blue-600';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className={`mt-0.5 ${iconColor}`}>
              <AlertCircle className="size-6" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>

        {children && <div className="px-2">{children}</div>}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={buttonVariant} onClick={onConfirm} loading={loading}>
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
