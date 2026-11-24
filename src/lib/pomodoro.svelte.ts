export type PomodoroMode = 'focus' | 'shortbreak' | 'longbreak';

type Settings = {
	focus: number;
	shortbreak: number;
	longbreak: number;
	intervals: number;
};

type CompletionHandler = (mode: PomodoroMode, minutes: number) => void;
type CompletionLogger = (minutes: number) => void;

function clampMinutes(value: number, fallback: number) {
	return Math.min(180, Math.max(1, Math.trunc(value) || fallback));
}

/**
 * Only timing lives here, at module scope: the layout's worker heartbeat keeps
 * it running while the reader is on another route. Settings, sound and the
 * database report stay on the pomodoro page.
 */
export const pomodoro = $state({
	mode: 'focus' as PomodoroMode,
	minutes: { focus: 7, shortbreak: 1, longbreak: 15 },
	intervals: 10,
	interval: 1,
	focusDone: false,
	isRunning: false,
	/** False until the first start, so editing a setting cannot rewrite this session. */
	started: false,
	sessionMs: 7 * 60_000,
	remainingMs: 7 * 60_000,
	endAt: 0
});

let completionHandler: CompletionHandler | null = null;
/** Registered by the authed layout, so off-page sessions are still recorded. */
let completionLogger: CompletionLogger | null = null;

/** Registers the page's logger/chime; returns the matching teardown. */
export function setPomodoroCompletionHandler(handler: CompletionHandler) {
	completionHandler = handler;

	return () => {
		if (completionHandler === handler) completionHandler = null;
	};
}

export function setPomodoroLogger(logger: CompletionLogger) {
	completionLogger = logger;

	return () => {
		if (completionLogger === logger) completionLogger = null;
	};
}

function durationMs(mode: PomodoroMode) {
	return pomodoro.minutes[mode] * 60_000;
}

/** The browser's own calendar day, shaped `YYYY-MM-DD`. */
export function localDateKey(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function configurePomodoro(settings: Settings) {
	pomodoro.minutes.focus = clampMinutes(settings.focus, 7);
	pomodoro.minutes.shortbreak = clampMinutes(settings.shortbreak, 1);
	pomodoro.minutes.longbreak = clampMinutes(settings.longbreak, 15);
	pomodoro.intervals = Math.min(12, Math.max(1, Math.trunc(settings.intervals) || 10));
	pomodoro.interval = Math.min(pomodoro.interval, pomodoro.intervals);

	if (!pomodoro.started) resetPomodoroSession();
}

export function resetPomodoroSession() {
	pomodoro.isRunning = false;
	pomodoro.started = false;
	pomodoro.endAt = 0;
	pomodoro.sessionMs = durationMs(pomodoro.mode);
	pomodoro.remainingMs = pomodoro.sessionMs;
}

export function startPomodoro() {
	if (pomodoro.isRunning) return;
	if (pomodoro.remainingMs <= 0) pomodoro.remainingMs = durationMs(pomodoro.mode);

	if (!pomodoro.started) {
		pomodoro.sessionMs = pomodoro.remainingMs;
		pomodoro.started = true;
	}

	// Anchor to the live clock, not the worker's last tick: a stale tick could
	// otherwise make a short session finish the moment it starts.
	pomodoro.endAt = Date.now() + pomodoro.remainingMs;
	pomodoro.isRunning = true;
}

export function pausePomodoro() {
	if (!pomodoro.isRunning) return;
	pomodoro.remainingMs = Math.max(0, pomodoro.endAt - Date.now());
	pomodoro.isRunning = false;
	pomodoro.endAt = 0;
}

export function togglePomodoro() {
	pomodoro.isRunning ? pausePomodoro() : startPomodoro();
}

export function selectPomodoroMode(mode: PomodoroMode) {
	if (mode === pomodoro.mode) return;
	pomodoro.mode = mode;
	pomodoro.focusDone = false;
	resetPomodoroSession();
}

/** Re-reads the worker's clock and rolls into the next session at zero. */
export function syncPomodoro(timestamp: number) {
	if (!pomodoro.isRunning) return;

	const msLeft = pomodoro.endAt - timestamp;
	pomodoro.remainingMs = Math.max(0, msLeft);

	if (msLeft > 0) return;

	completePomodoro();
}

function completePomodoro() {
	const completed = pomodoro.mode;
	const minutes = Math.max(1, Math.round(pomodoro.sessionMs / 60_000));

	pomodoro.isRunning = false;
	pomodoro.endAt = 0;
	// The page logs when it is mounted (and shows its own error); otherwise the
	// layout's logger records the session so minutes are never lost off-page.
	if (completed === 'focus' && !completionHandler) completionLogger?.(minutes);
	completionHandler?.(completed, minutes);

	if (completed === 'focus') {
		pomodoro.focusDone = true;
		pomodoro.mode =
			pomodoro.interval >= pomodoro.intervals ? 'longbreak' : 'shortbreak';
	} else {
		if (pomodoro.focusDone) {
			pomodoro.interval =
				pomodoro.interval >= pomodoro.intervals ? 1 : pomodoro.interval + 1;
			pomodoro.focusDone = false;
		}
		pomodoro.mode = 'focus';
	}

	pomodoro.sessionMs = durationMs(pomodoro.mode);
	pomodoro.remainingMs = pomodoro.sessionMs;
	pomodoro.started = false;
	startPomodoro();
}
