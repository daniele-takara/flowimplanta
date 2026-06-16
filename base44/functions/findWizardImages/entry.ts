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

        // Only list root directory - images are in root
        const res = await fetch(`${base}`, { headers });
        if (!res.ok) return Response.json({ error: `HTTP ${res.status}` }, { status: 500 });
        const items = await res.json();
        
        const images = items
            .filter(f => /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp)$/i.test(f.name))
            .map(f => ({ name: f.name, path: f.path, size: f.size, sha: f.sha }));

        return Response.json({ images, count: images.length });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});