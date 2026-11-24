/** Dashboard settings shared by the dashboard route and the weather fetcher. */

export const DASHBOARD_USER = 'thinh';
export const DEFAULT_FORECAST_MODEL = 'ecmwf_ifs';

export const FORECAST_MODELS: { value: string; label: string }[] = [
	{ value: 'icon_seamless', label: 'DWD Germany' },
	{ value: 'gfs_seamless', label: 'NOAA U.S' },
	{ value: 'ecmwf_ifs', label: 'ECMWF' },
	{ value: 'ukmo_seamless', label: 'UK Met Office' },
	{ value: 'kma_seamless', label: 'KMA Korea' },
	{ value: 'jma_seamless', label: 'JMA Japan' },
	{ value: 'metno_seamless', label: 'MET Norway' },
	{ value: 'gem_seamless', label: 'GEM Canada' },
	{ value: 'cma_grapes_global', label: 'CMA China' },
	{ value: 'knmi_seamless', label: 'KNMI Netherlands' },
	{ value: 'dmi_seamless', label: 'DMI Denmark' }
];

export type DashboardLocation = { id: string; name: string; latitude: string; longitude: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function numericString(value: unknown): string | null {
	if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
	if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
		return value.trim();
	}
	return null;
}

export function parseLocations(value: unknown): DashboardLocation[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		if (!isRecord(entry)) return [];
		const latitude = numericString(entry.latitude);
		const longitude = numericString(entry.longitude);
		return typeof entry.id === 'string' &&
			typeof entry.name === 'string' &&
			latitude !== null &&
			longitude !== null
			? [{ id: entry.id, name: entry.name, latitude, longitude }]
			: [];
	});
}
