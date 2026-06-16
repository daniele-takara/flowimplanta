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

        // Fetch just Index.tsx
        const res = await fetch(`${base}/src/pages/Index.tsx`, { headers });
        if (!res.ok) return Response.json({ error: `HTTP ${res.status}`, body: await res.text() });
        
        const fileInfo = await res.json();
        const contentRes = await fetch(fileInfo.download_url, { headers });
        const content = await contentRes.text();

        return Response.json({ path: fileInfo.path, size: fileInfo.size, content });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});