import type { APIRoute } from "astro";

export const POST: APIRoute = async (context) => {
	const tag = context.url.searchParams.get("tag")!;
	await context.cache.invalidate({ tags: [tag] });
	return new Response(null, { status: 204 });
};
