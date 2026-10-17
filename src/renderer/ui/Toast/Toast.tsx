import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import * as Radix from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { cx } from '../cx';
import { IconButton } from '../IconButton/IconButton';
import styles from './Toast.module.scss';

export type ToastVariant = 'info' | 'success' | 'danger';

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastEntry extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}

export interface ToastProviderProps {
  children: ReactNode;
  closeLabel: string;
  regionLabel: string;
}

let nextToastId = 1;

export function ToastProvider({ children, closeLabel, regionLabel }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const show = useCallback((options: ToastOptions) => {
    setToasts((current) => [...current, { ...options, id: nextToastId++ }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext value={value}>
      <Radix.Provider label={regionLabel}>
        {children}
        {toasts.map((toast) => (
          <Radix.Root
            key={toast.id}
            duration={toast.duration ?? 5000}
            onOpenChange={(open) => {
              if (!open) dismiss(toast.id);
            }}
            className={cx(styles['toast'], styles[toast.variant ?? 'info'])}
          >
            <div className={styles['text']}>
              <Radix.Title className={styles['title']}>{toast.title}</Radix.Title>
              {toast.description ? (
                <Radix.Description className={styles['description']}>{toast.description}</Radix.Description>
              ) : null}
            </div>
            <Radix.Close asChild>
              <IconButton label={closeLabel} size="sm" tooltip={false}>
                <X aria-hidden="true" />
              </IconButton>
            </Radix.Close>
          </Radix.Root>
        ))}
        <Radix.Viewport className={styles['viewport']} />
      </Radix.Provider>
    </ToastContext>
  );
}
