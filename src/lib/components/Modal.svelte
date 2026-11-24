<script module lang="ts">
	// Shared modal chrome so every header reads the same.
	export const modalHeader =
		'flex h-9 shrink-0 items-center justify-between bg-black px-4 text-white';
	export const modalTitle = 'text-base font-semibold leading-none';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		showModal?: boolean;
		label: string;
		children?: Snippet;
	}

	let { showModal = $bindable(false), label, children }: Props = $props();

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (showModal && !dialog.open) dialog.showModal();
		else if (!showModal && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-label={label}
	onclose={() => (showModal = false)}
	onclick={(event) => {
		if (event.target === dialog) dialog?.close();
	}}
	class="mx-auto my-auto h-dvh max-h-none max-w-none overflow-y-auto border-0 bg-transparent p-0"
>
	{#if showModal}
		{@render children?.()}
	{/if}
</dialog>

<style>
	dialog::backdrop {
		background: rgb(0 0 0 / 0.3);
	}
</style>
