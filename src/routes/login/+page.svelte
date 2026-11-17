<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();

	// A server load redirects signed-in users away from /login; re-run it when
	// the page is restored from bfcache after sign-in.
	$effect(() => {
		const onPageShow = (event: PageTransitionEvent) => {
			if (event.persisted) invalidateAll();
		};

		addEventListener('pageshow', onPageShow);
		return () => removeEventListener('pageshow', onPageShow);
	});
</script>

<svelte:head>
	<title>Sign in</title>
</svelte:head>

<div class="min-h-dvh bg-[#f2f3ee] text-[#11130f]">
	<header class="flex items-center justify-between px-6 py-5 md:px-10">
		<span class="text-sm font-semibold tracking-tight">svelte-neon</span>
		<span class="text-xs text-[#5f665c]">Neon Auth</span>
	</header>

	<main
		class="mx-auto grid max-w-5xl gap-12 px-6 pb-16 pt-10 md:grid-cols-[1.1fr_0.9fr] md:px-10 md:pt-20"
	>
		<div>
			<h1
				class="text-[clamp(3.5rem,8vw,6.5rem)] font-semibold leading-[0.9] tracking-[-0.05em]"
			>
				Welcome<br />back.
			</h1>
			<p class="mt-8 max-w-[34ch] text-sm leading-relaxed text-[#5f665c]">
				Enter your password to continue.
			</p>
		</div>

		<div class="flex flex-col justify-end">
			<form method="POST" class="w-full max-w-sm self-end">
				<label for="password" class="block text-sm font-medium">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					class="mt-1 w-full min-w-0 border-b border-[#c9cec3] bg-transparent py-2.5 outline-none focus:border-[#2547ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2547ff]"
				/>

				{#if form?.error}
					<p role="alert" class="mt-5 text-sm text-[#b42318]">{form.error}</p>
				{/if}

				<button
					type="submit"
					class="mt-8 w-full rounded-none bg-[#11130f] py-3 font-medium text-white transition-opacity hover:opacity-90"
				>
					Sign in
				</button>
			</form>
		</div>
	</main>
</div>
