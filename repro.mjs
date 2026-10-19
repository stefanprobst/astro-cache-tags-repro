/**
 * Renders `/` into the cache, invalidates one tag, and checks whether `/` is re-rendered. Each tag is set from a
 * different place: the page's frontmatter, its layout, and a child component.
 */
const base = process.env.BASE_URL ?? "http://localhost:4321";

async function get() {
	const response = await fetch(base);
	const html = await response.text();
	return { cache: response.headers.get("x-astro-cache"), renderedAt: /id="rendered-at">(\d+)/.exec(html)[1] };
}

for (const tag of [
	"page-tag",
	"page-tag-after-await",
	"layout-tag",
	"layout-tag-after-await",
	"component-tag",
	"component-tag-after-await",
]) {
	/** Start from a fresh cache entry. */
	await fetch(`${base}/api/invalidate?tag=page-tag`, { method: "POST" });
	const before = await get();
	const cached = await get();

	await fetch(`${base}/api/invalidate?tag=${tag}`, { method: "POST" });
	const after = await get();

	const invalidated = after.renderedAt !== cached.renderedAt;
	console.log(
		`${tag.padEnd(26)} ${before.cache} -> ${cached.cache} -> invalidate -> ${after.cache}  ${invalidated ? "ok: re-rendered" : "BUG: still served from cache"}`,
	);
}
