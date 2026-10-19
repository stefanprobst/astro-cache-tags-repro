# `Astro.cache.set()` in layouts and components is silently dropped once rendering has awaited

Astro 7.4.0, `@astrojs/node` 11.1.8 (standalone), `memoryCache()`.

## Steps

```sh
npm install
npm run build
npm start          # in one terminal, http://localhost:4321
npm run repro      # in another
```

`/` sets `maxAge` and a tag in its frontmatter, and more tags in its layout and in a child component - each once
synchronously, and once after an `await` (e.g. after loading content). `repro.mjs` renders `/` into the cache,
invalidates one tag, and checks whether `/` is re-rendered.

## Actual

```
page-tag                   MISS -> HIT -> invalidate -> MISS  ok: re-rendered
page-tag-after-await       MISS -> HIT -> invalidate -> MISS  ok: re-rendered
layout-tag                 MISS -> HIT -> invalidate -> MISS  ok: re-rendered
layout-tag-after-await     MISS -> HIT -> invalidate -> HIT  BUG: still served from cache
component-tag              MISS -> HIT -> invalidate -> HIT  BUG: still served from cache
component-tag-after-await  MISS -> HIT -> invalidate -> HIT  BUG: still served from cache
```

Nothing is logged.

## Expected

Invalidating any tag which the page set re-renders it - the
[route caching guide](https://docs.astro.build/en/guides/caching/) says "Middleware, layouts, content loaders, and page
code can each contribute cache directives independently." Or, if that is not possible, a warning when `cache.set()` is
called too late to take effect.

## Cause

The page is streamed: the response is created once rendering first awaits outside of the page's frontmatter, and the
cache handler reads the cache options from it right then (`applyCacheHeaders()` after `next()` in
`dist/core/cache/handler.js`), as `Cache-Tag` and `CDN-Cache-Control` headers. Directives which are set later still
show up in `Astro.cache.tags`, but never reach the cache. `component-tag` is lost although it is set synchronously,
since the layout has awaited before the component renders.

For CDN providers, headers have to be known before the body is sent. But `memoryCache()` reads the whole body before
storing an entry anyway (`serializeResponse()` in `dist/core/cache/memory-provider.js`), so it could read the cache
options once rendering has finished.

## Workaround

Buffer the body in middleware, which runs inside the cache handler, so that the whole page renders before the cache
reads its headers:

```ts
export const onRequest = defineMiddleware(async (context, next) => {
	const response = await next();

	return response.body == null ? response : new Response(await response.arrayBuffer(), response);
});
```
