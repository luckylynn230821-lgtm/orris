import { createFileRoute } from "@tanstack/react-router";
import { publishedSlugs } from "@/lib/commerce/fns";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const data = await publishedSlugs();
        const origin = new URL(request.url).origin;
        const urls = ["/", "/shop", "/collections", "/about", ...data.slugs.map((slug) => `/product/${slug}`)];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
          .map((path) => `  <url><loc>${origin}${path}</loc></url>`)
          .join("\n")}\n</urlset>`;
        return new Response(xml, { headers: { "content-type": "application/xml" } });
      },
    },
  },
});
