<script lang="ts">
	import { tick } from 'svelte';

	interface Props {
		totalItems: number;
		itemsPerPage: number;
		currentPage: number;
		onPageChange: (page: number) => void;
	}

	let { totalItems, itemsPerPage, currentPage, onPageChange }: Props = $props();

	const totalPages = $derived(
		Math.max(1, itemsPerPage > 0 ? Math.ceil(totalItems / itemsPerPage) : 1)
	);

	// currentPage often comes from URL state; clamp it so the control never lies.
	const activePage = $derived(
		Math.min(totalPages, Math.max(1, Math.trunc(currentPage) || 1))
	);

	// Inner window only — pages 1 and totalPages are always rendered separately.
	const pages = $derived.by(() => {
		let start = Math.max(1, activePage - 2);
		let end = Math.min(totalPages - 1, activePage + 2);

		if (totalPages <= 6 && totalPages > 1) {
			start = 2;
			end = totalPages - 1;
		}

		if (activePage <= 3 && totalPages > 6) {
			start = 2;
			end = Math.min(5, activePage + 2);
		}

		if (activePage >= totalPages - 2 && totalPages > 6) {
			start = Math.max(totalPages - 4, 1);
			end = totalPages - 1;
		}

		const range: number[] = [];
		for (let i = start; i <= end; i++) range.push(i);
		return range;
	});

	let openInput = $state<'prev' | 'next' | null>(null);
	let inputPage = $state<number | undefined>();
	let pageInputEl = $state<HTMLInputElement>();

	const buttonClass =
		'h-6 min-w-6 rounded-[2px] bg-white/30 px-1.5 text-xs leading-none text-black/60 shadow-[0_1px_3px_rgba(0,0,0,0.3)] backdrop-blur-[6px] transition-colors hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2547ff] disabled:cursor-not-allowed disabled:text-black/10';
	const inputClass =
		'h-6 w-12 rounded-[2px] bg-white/30 text-center text-xs leading-none text-black shadow-[0_1px_3px_rgba(0,0,0,0.3)] backdrop-blur-[6px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2547ff]';

	function changePage(page: number) {
		if (page >= 1 && page <= totalPages && page !== activePage) onPageChange(page);
		openInput = null;
	}

	async function openPageInput(kind: 'prev' | 'next') {
		const hidden = kind === 'prev' ? pages[0] - 1 : pages[pages.length - 1] + 1;
		inputPage = Math.min(totalPages, Math.max(1, hidden));
		openInput = kind;
		await tick();
		pageInputEl?.select();
	}

	function commitInput() {
		// The blur that follows an Enter commit must not fire the callback twice.
		if (openInput === null) return;
		openInput = null;
		if (inputPage === undefined || !Number.isFinite(inputPage)) return;
		const page = Math.min(totalPages, Math.max(1, Math.trunc(inputPage)));
		if (page !== activePage) onPageChange(page);
	}

	function handleInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitInput();
		}
	}
</script>

{#snippet pageButton(page: number)}
	<button
		type="button"
		class="{buttonClass} {page === activePage ? 'bg-white/80 text-black' : ''}"
		aria-current={page === activePage ? 'page' : undefined}
		onclick={() => changePage(page)}
	>
		{page}
	</button>
{/snippet}

{#if totalPages > 1}
	<nav aria-label="Pagination" class="flex w-full items-center justify-center gap-[3px]">
		<button
			type="button"
			class={buttonClass}
			disabled={activePage <= 1}
			onclick={() => changePage(activePage - 1)}
		>
			Prev
		</button>

		{@render pageButton(1)}

		{#if totalPages >= 7 && activePage > 4}
			{#if openInput === 'prev'}
				<input
					type="number"
					min="1"
					max={totalPages}
					aria-label="Go to page"
					inputmode="numeric"
					bind:this={pageInputEl}
					bind:value={inputPage}
					onkeydown={handleInputKeydown}
					onblur={commitInput}
					class={inputClass}
				/>
			{:else}
				<button
					type="button"
					class={buttonClass}
					aria-label="Go to an earlier page"
					onclick={() => openPageInput('prev')}
				>
					...
				</button>
			{/if}
		{/if}

		{#each pages as page (page)}
			{@render pageButton(page)}
		{/each}

		{#if totalPages >= 7 && activePage < totalPages - 3}
			{#if openInput === 'next'}
				<input
					type="number"
					min="1"
					max={totalPages}
					aria-label="Go to page"
					inputmode="numeric"
					bind:this={pageInputEl}
					bind:value={inputPage}
					onkeydown={handleInputKeydown}
					onblur={commitInput}
					class={inputClass}
				/>
			{:else}
				<button
					type="button"
					class={buttonClass}
					aria-label="Go to a later page"
					onclick={() => openPageInput('next')}
				>
					...
				</button>
			{/if}
		{/if}

		{@render pageButton(totalPages)}

		<button
			type="button"
			class={buttonClass}
			disabled={activePage >= totalPages}
			onclick={() => changePage(activePage + 1)}
		>
			Next
		</button>
	</nav>
{/if}
