import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { name } = body;
        if (!name) return Response.json({ error: 'Missing image name' }, { status: 400 });

        const token = Deno.env.get("GITHUB_ACCESS_TOKEN");
        const owner = "naomi-wagatsuma";
        const repo = "regra-calculo-wizard";
        const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" };

        // Get the image metadata to find download_url
        const metaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(name)}`, { headers });
        if (!metaRes.ok) return Response.json({ error: `Image not found: ${metaRes.status}` }, { status: 404 });
        const meta = await metaRes.json();

        // Download the image
        const dl = await fetch(meta.download_url, { headers });
        if (!dl.ok) return Response.json({ error: `Download failed: ${dl.status}` }, { status: 500 });
        
        const arrayBuf = await dl.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        const base64 = btoa(String.fromCharCode(...bytes));
        const mimeType = meta.name.endsWith('.svg') ? 'image/svg+xml' : 'image/png';

        return Response.json({ 
            name: meta.name, 
            data_url: `data:${mimeType};base64,${base64}`,
            size: meta.size 
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});