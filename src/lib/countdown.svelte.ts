import { browser } from '$app/env';

/** The navbar's quick timer: one click starts six minutes. */
export const QUICK_TIMER_MINUTES = 6;
const DURATION_MS = QUICK_TIMER_MINUTES * 60_000;
const STORAGE_KEY = 'quick-timer:end';

/**
 * Module scope, like the pomodoro timer, so the layout's heartbeat keeps it
 * accurate while the reader moves between routes. No interval of its own:
 * `syncCountdown` is fed the worker's wall clock.
 */
export const countdown = $state({
	/** Wall-clock end, 0 while idle. */
	endAt: 0,
	/** Whole seconds left, for the navbar readout. */
	secondsRemaining: QUICK_TIMER_MINUTES * 60
});

/** Resumes a timer a reload interrupted, after hydration so SSR stays stable. */
export function restoreCountdown() {
	if (!browser || countdown.endAt) return;

	try {
		const end = Number(localStorage.getItem(STORAGE_KEY));
		if (!Number.isFinite(end) || end <= Date.now()) {
			localStorage.removeItem(STORAGE_KEY);
			return;
		}

		countdown.endAt = end;
		countdown.secondsRemaining = Math.ceil((end - Date.now()) / 1000);
	} catch {
		// Storage can be blocked; the timer simply starts from scratch.
	}
}

function rememberEnd(end: number) {
	if (!browser) return;

	try {
		if (end) localStorage.setItem(STORAGE_KEY, String(end));
		else localStorage.removeItem(STORAGE_KEY);
	} catch {
		// A refused write only costs the timer its reload protection.
	}
}

export function startCountdown() {
	countdown.endAt = Date.now() + DURATION_MS;
	countdown.secondsRemaining = QUICK_TIMER_MINUTES * 60;
	rememberEnd(countdown.endAt);
	// Request here: the click is a user gesture, unlike the timer's end.
	void ensureNotificationPermission();
}

export function stopCountdown() {
	countdown.endAt = 0;
	countdown.secondsRemaining = QUICK_TIMER_MINUTES * 60;
	rememberEnd(0);
}

/** Re-reads the worker's clock, and rings once the wall clock passes zero. */
export function syncCountdown(timestamp = Date.now()) {
	if (!countdown.endAt) return;

	const msLeft = countdown.endAt - timestamp;
	countdown.secondsRemaining = Math.max(0, Math.ceil(msLeft / 1000));

	if (msLeft > 0) return;

	// Clear before notifying: a late tick must not ring twice.
	countdown.endAt = 0;
	countdown.secondsRemaining = 0;
	rememberEnd(0);
	notifyTimeUp();
}

async function ensureNotificationPermission() {
	if (!browser || !('Notification' in window)) return;
	if (Notification.permission !== 'default') return;

	try {
		await Notification.requestPermission();
	} catch {
		// Dismissed prompts and embedded browsers can both refuse.
	}
}

function notifyTimeUp() {
	if (browser && 'Notification' in window && Notification.permission === 'granted') {
		try {
			const notification = new Notification('Time is up', {
				body: `${QUICK_TIMER_MINUTES} minutes are over.`,
				icon: '/images/2617511.png',
				tag: 'quick-timer',
				requireInteraction: true
			});
			notification.onclick = () => {
				window.focus();
				notification.close();
			};
			return;
		} catch {
			// Some platforms only allow notifications from a service worker.
		}
	}

	if (browser) void new Audio('/audio/mp3_Ding.mp3').play().catch(() => {});
}
