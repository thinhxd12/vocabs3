## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: tailwindcss, drizzle

---
# Agent Orchestration & Engineering Rules

## Role Hierarchy
- **`svelte-lead` (Primary Orchestrator)**: Owns task planning, SvelteKit routing (`+page.server.ts`, `+server.ts`), state wiring, and final integration. Never write raw Drizzle schemas/migrations or complex Tailwind layouts directly—delegate them to your subagents.
- **`@db-engineer` (Subagent)**: Owns Drizzle ORM schemas (`src/lib/server/db/schema.ts`), `drizzle-kit` migrations, relational/SQL queries, indexes, and Neon connection pooling.
- **`@ui-designer` (Subagent)**: Owns `.svelte` markup, Tailwind CSS styling, responsive layouts, micro-interactions, and accessibility (ARIA/keyboard navigation).
- **`@svelte-reviewer` (Subagent)**: Read-only auditor for Svelte 5 runes, SSR/CSR security boundaries, Drizzle query safety, and TypeScript strictness.

## Mandatory Auto-Delegation Workflow

1. **Database & Drizzle Layer (`@db-engineer`)**
   - **Trigger**: Any task involving tables, columns, relations, migrations, seed scripts, complex queries, or Neon `DATABASE_URL` setup.
   - **Action**: Delegate to `@db-engineer` *before* writing SvelteKit loaders or form actions. Require `@db-engineer` to export inferred Drizzle types (`$inferSelect`, `$inferInsert`) so `svelte-lead` and `@ui-designer` share a single source of truth.

2. **UI & Tailwind Styling (`@ui-designer`)**
   - **Trigger**: Creating new UI components, building pages, styling forms, fixing responsive/layout issues, or adding dark mode/animations.
   - **Action**: Delegate visual structure and Tailwind classes to `@ui-designer`. Provide the exact TypeScript prop interface (using Drizzle inferred types where applicable) so `@ui-designer` builds pure, prop-driven components.

3. **Parallel Spawning**
   - When a feature needs both schema/query work and new UI, spawn `@db-engineer` and `@ui-designer` **in parallel** with an agreed TypeScript contract.

4. **Mandatory Code Audit (`@svelte-reviewer`)**
   - **Trigger**: After `svelte-lead` or any subagent finishes creating or editing files.
   - **Action**: Always invoke `@svelte-reviewer` before completing the task. Fix any critical issues reported (especially accidental `$lib/server` imports in client files or missing input validation) before responding to the user.

## Stack Conventions
- **Svelte 5**: Always use runes (`$state`, `$derived`, `$effect`, `$props`, `$bindable`). Do not use legacy `export let` or `$:` reactive statements.
- **Drizzle + Neon**: Keep all DB instances, schemas, and queries strictly inside `src/lib/server/db/`. Use prepared statements or parameterized `eq()`/`and()` helpers—never interpolate raw strings into `sql`` `.
- **Tailwind CSS**: Use utility classes directly in `.svelte` templates. Avoid `@apply` in `<style>` blocks unless wrapping third-party library styles.
- **Verification**: Ensure `npm run check` (`svelte-check`) passes with zero errors before finishing.


You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.