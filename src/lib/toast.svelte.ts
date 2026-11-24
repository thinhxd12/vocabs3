/** A tiny toast queue; runes in a `.svelte.ts` module keep it reactive. */
export type ToastType = "error" | "success" | "info";

export type Toast = {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
};

export const toasts = $state<Toast[]>([]);

const LIFETIME = 5000;
const MAX_VISIBLE = 3;

let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function addToast(toast: {
  type: ToastType;
  title: string;
  message?: string;
}) {
  const id = nextId++;
  toasts.push({ id, ...toast });

  if (toasts.length > MAX_VISIBLE) dismissToast(toasts[0].id);

  timers.set(id, setTimeout(() => dismissToast(id), LIFETIME));
  return id;
}

export function dismissToast(id: number) {
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index !== -1) toasts.splice(index, 1);

  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
}
