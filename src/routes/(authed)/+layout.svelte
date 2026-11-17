<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// Non-reactive: remembers which expiry was already revalidated, so a
	// server/client clock difference cannot cause an invalidate loop.
	let expiredFor: number | null = null;

	$effect(() => {
		const expiresAt = data.expiresAt;
		if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return;

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
				document.visibilityState === 'visible' &&
				typeof expiresAt === 'number' &&
				Date.now() >= expiresAt &&
				expiresAt !== expiredFor
			) {
				expiredFor = expiresAt;
				invalidateAll();
			}
		};

		addEventListener('pageshow', onPageShow);
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			removeEventListener('pageshow', onPageShow);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});
</script>

<div class="min-h-dvh bg-[#f2f3ee] text-[#11130f]">
	<header
		class="flex items-center justify-between border-b border-[#dde1d8] px-6 py-4 md:px-10"
	>
		<a href="/" class="text-sm font-semibold tracking-tight">svelte-neon</a>
		<form method="POST" action="/logout">
			<button
				type="submit"
				class="text-xs text-[#5f665c] underline underline-offset-4 hover:text-[#11130f]"
			>
				Sign out
			</button>
		</form>
	</header>

	{@render children()}
</div>
