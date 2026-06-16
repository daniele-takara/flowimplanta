import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = Deno.env.get("GITHUB_ACCESS_TOKEN");
        const owner = "naomi-wagatsuma";
        const repo = "regra-calculo-wizard";
        const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" };
        const base = `https://api.github.com/repos/${owner}/${repo}/contents`;

        // List all images
        const listRes = await fetch(`${base}`, { headers });
        if (!listRes.ok) return Response.json({ error: `List failed: ${listRes.status}` }, { status: 500 });
        const items = await listRes.json();
        const images = items.filter(f => /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp)$/i.test(f.name));

        const imageMap = {};
        for (const img of images) {
            try {
                const dl = await fetch(img.download_url, { headers });
                if (!dl.ok) continue;
                const arrayBuf = await dl.arrayBuffer();
                const bytes = new Uint8Array(arrayBuf);
                const base64 = btoa(String.fromCharCode(...bytes));
                const mimeType = img.name.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
                imageMap[img.name] = `data:${mimeType};base64,${base64}`;
            } catch (e) {
                console.error(`Failed to fetch ${img.name}:`, e);
            }
        }

        return Response.json({ images: imageMap, count: Object.keys(imageMap).length });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});