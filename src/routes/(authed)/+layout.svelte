<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import { onMount } from "svelte";
  import {
    restoreCountdown,
    stopCountdown,
    syncCountdown,
  } from "#lib/countdown.svelte.ts";
  import {
    localDateKey,
    resetPomodoroSession,
    setPomodoroLogger,
    syncPomodoro,
  } from "#lib/pomodoro.svelte.ts";
  import type { LayoutProps } from "./$types";

  let { children, data }: LayoutProps = $props();

  // Non-reactive: remembers which expiry was already revalidated, so a
  // server/client clock difference cannot cause an invalidate loop.
  let expiredFor: number | null = null;

  $effect(() => {
    const expiresAt = data.expiresAt;
    if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) return;

    const remaining = Math.max(0, expiresAt - Date.now());

    if (remaining === 0) {
      if (expiresAt !== expiredFor) {
        expiredFor = expiresAt;
        invalidateAll();
      }
      return;
    }

    const timer = setTimeout(() => {
      expiredFor = expiresAt;
      invalidateAll();
    }, remaining);

    return () => clearTimeout(timer);
  });

  $effect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) invalidateAll();
    };

    const onVisibilityChange = () => {
      const expiresAt = data.expiresAt;
      if (
        document.visibilityState === "visible" &&
        typeof expiresAt === "number" &&
        Date.now() >= expiresAt &&
        expiresAt !== expiredFor
      ) {
        expiredFor = expiresAt;
        invalidateAll();
      }
    };

    addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  });

  // One worker heartbeat for both timers: wall-clock ticks survive a throttled tab.
  onMount(() => {
    restoreCountdown();

    // The logger lives here, not on /pomodoro: a focus session can end while
    // the reader is on another route, and its minutes must still be recorded.
    const stopLogger = setPomodoroLogger((minutes) => {
      const body = new FormData();
      body.set("date", localDateKey());
      body.set("minutes", String(minutes));
      void fetch("/pomodoro?/add", {
        method: "POST",
        body,
        headers: { "x-sveltekit-action": "true" },
      })
        .then((response) => {
          if (response.ok) void invalidateAll();
        })
        .catch(() => {});
    });

    let worker: Worker | null = null;
    let fallback: ReturnType<typeof setInterval> | undefined;

    const tick = (timestamp: number) => {
      syncPomodoro(timestamp);
      syncCountdown(timestamp);
    };

    if (typeof Worker !== "undefined") {
      try {
        worker = new Worker(
          new URL("../../lib/workers/timer.worker.ts", import.meta.url),
          { type: "module" },
        );
        worker.onmessage = (event: MessageEvent<{ timestamp?: number }>) => {
          if (typeof event.data?.timestamp === "number") tick(event.data.timestamp);
        };
        // If the worker cannot load, keep both timers alive on the main thread.
        worker.onerror = () => {
          worker?.terminate();
          worker = null;
          fallback ??= setInterval(() => tick(Date.now()), 1000);
        };
        worker.postMessage({ action: "START" });
      } catch {
        worker?.terminate();
        worker = null;
      }
    }

    if (!worker) fallback = setInterval(() => tick(Date.now()), 1000);

    return () => {
      // Signing out removes the heartbeat; neither timer may carry over.
      stopLogger();
      resetPomodoroSession();
      stopCountdown();
      if (worker) {
        worker.postMessage({ action: "STOP" });
        worker.terminate();
        worker = null;
      }
      if (fallback) {
        clearInterval(fallback);
        fallback = undefined;
      }
    };
  });
</script>

<div class="min-h-full">
  {@render children()}
</div>
