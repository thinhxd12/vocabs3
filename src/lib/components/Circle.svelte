<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();
</script>

<!-- Gold ring around an inscribed square media area; scales to its container. -->
<div
	class="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-full bg-linear-to-r from-[#9a7a3b] to-[#e6d3a1] p-[4px] shadow-[0_6px_15px_rgba(0,0,0,0.6)]"
>
	<div
		class="flex size-full items-center justify-center rounded-full bg-[radial-gradient(circle,#060606_30%,#020406_100%)]"
	>
		<div
			class="flex size-[70.71%] items-center justify-center bg-linear-to-r from-[#8f763b] to-[#d2c28e] p-[1px]"
		>
			<div
				class="relative size-full bg-[radial-gradient(circle,#060606_30%,#020406_100%)]"
			>
				{@render children?.()}
			</div>
		</div>
	</div>
</div>
