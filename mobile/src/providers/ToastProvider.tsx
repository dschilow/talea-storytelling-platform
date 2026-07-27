import React, { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react-native';

import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';

/**
 * Toasts — the native replacement for the web's `sonner` notifications.
 *
 * They render from the top because the bottom of the screen is occupied by the
 * tab bar and the mini player, and they carry a matching haptic so feedback
 * lands even when the user is not looking at the top of the screen.
 */

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  show: (toast: Omit<Toast, 'id'> & { durationMs?: number }) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_DURATION_MS = 3800;
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback<ToastContextValue['show']>(
    ({ durationMs = DEFAULT_DURATION_MS, ...toast }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { ...toast, id }]);

      haptic(toast.kind === 'error' ? 'error' : toast.kind === 'warning' ? 'warning' : toast.kind === 'success' ? 'success' : 'light');

      timers.current.set(
        id,
        setTimeout(() => dismiss(id), durationMs)
      );
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      dismiss,
      success: (message, description) => show({ kind: 'success', message, description }),
      error: (message, description) => show({ kind: 'error', message, description, durationMs: 5200 }),
      info: (message, description) => show({ kind: 'info', message, description }),
      warning: (message, description) => show({ kind: 'warning', message, description }),
    }),
    [dismiss, show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const insets = useSafeAreaInsets();
  const { spacing } = useTheme();

  if (toasts.length === 0) return null;

  return (
    <View
      style={[styles.viewport, { top: insets.top + spacing.sm, paddingHorizontal: spacing.base, gap: spacing.sm }]}
      pointerEvents="box-none"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { colors, spacing, radius, shadows } = useTheme();

  const config: Record<ToastKind, { color: string; background: string; Icon: typeof Info }> = {
    success: { color: colors.success, background: colors.successSoft, Icon: CheckCircle2 },
    error: { color: colors.danger, background: colors.dangerSoft, Icon: XCircle },
    warning: { color: colors.warning, background: colors.warningSoft, Icon: AlertTriangle },
    info: { color: colors.primary, background: colors.surface.inset, Icon: Info },
  };

  const { color, background, Icon } = config[toast.kind];

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(20)}
      exiting={FadeOutUp.duration(180)}
      layout={LinearTransition.springify().damping(22)}
      style={[
        styles.toast,
        shadows.strong,
        {
          borderRadius: radius.lg,
          backgroundColor: colors.pageSolid,
          borderColor: colors.border.soft,
          padding: spacing.md,
          gap: spacing.md,
        },
      ]}
    >
      <View style={[styles.iconShell, { backgroundColor: background, borderRadius: radius.sm }]}>
        <Icon size={18} color={color} />
      </View>

      <View style={styles.body}>
        <Text variant="label" numberOfLines={2}>
          {toast.message}
        </Text>
        {toast.description ? (
          <Text variant="caption" tone="secondary" numberOfLines={3}>
            {toast.description}
          </Text>
        ) : null}
      </View>

      {toast.actionLabel && toast.onAction ? (
        <Touchable
          onPress={() => {
            toast.onAction?.();
            onDismiss(toast.id);
          }}
          style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
        >
          <Text variant="labelSm" tone="accent">
            {toast.actionLabel}
          </Text>
        </Touchable>
      ) : (
        <Touchable onPress={() => onDismiss(toast.id)} style={{ padding: spacing.xs }} hapticIntent={null}>
          <Text variant="caption" tone="tertiary">
            ✕
          </Text>
        </Touchable>
      )}
    </Animated.View>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}

const styles = StyleSheet.create({
  viewport: { position: 'absolute', left: 0, right: 0, zIndex: 100 },
  toast: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  iconShell: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
});
