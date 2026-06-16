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
        const items = await listRes.json();
        const images = items.filter(f => /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp)$/i.test(f.name));

        const results = [];
        for (const img of images) {
            try {
                // Download image
                const dl = await fetch(img.download_url, { headers });
                const arrayBuf = await dl.arrayBuffer();
                const bytes = new Uint8Array(arrayBuf);
                
                // Upload to Base44 storage
                const uploaded = await base44.asServiceRole.integrations.Core.UploadFile({ file: bytes });
                
                results.push({ 
                    original_name: img.name, 
                    file_url: uploaded.file_url,
                    success: true 
                });
            } catch (e) {
                results.push({ 
                    original_name: img.name, 
                    error: String(e?.message || e),
                    success: false 
                });
            }
        }

        const imageMap = {};
        results.forEach(r => { if (r.success) imageMap[r.original_name] = r.file_url; });

        return Response.json({ results, image_map: imageMap });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});