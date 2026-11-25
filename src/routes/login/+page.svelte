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

<div class="flex min-h-full items-center justify-center px-6 py-10">
	<main class="light w-full max-w-sm px-7 py-9 text-[#11130f] sm:px-9 sm:py-10">
		<h1 class="text-[3.75rem] font-semibold leading-[0.92] tracking-[-0.04em]">
			Welcome<br />back.
		</h1>

		<form method="POST" class="mt-10 w-full">
			<label for="password" class="block text-sm font-medium">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
				class="mt-1 w-full min-w-0 border-b border-[#c9cec3] bg-transparent py-2.5 outline-none focus:border-green-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2547ff]"
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
	</main>
</div>
