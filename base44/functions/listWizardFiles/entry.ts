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

        // List ALL component files
        async function listDir(path) {
            const res = await fetch(`${base}/${path}`, { headers });
            if (!res.ok) return [];
            const items = await res.json();
            return items.map(f => ({ name: f.name, type: f.type, path: f.path }));
        }

        const [components, contexts, hooks, types] = await Promise.all([
            listDir("src/components"),
            listDir("src/contexts"),
            listDir("src/hooks"),
            listDir("src/types"),
        ]);

        return Response.json({
            components,
            contexts,
            hooks,
            types,
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});