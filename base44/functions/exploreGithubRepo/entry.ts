import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Only .tsx and .ts files, no images/assets/configs
const KEY_FILES = [
    "src/pages/Index.tsx",
    "src/components/CalculationModelsModal.tsx",
];

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

        async function listDir(path) {
            const res = await fetch(`${base}/${path}`, { headers });
            if (!res.ok) return [];
            const items = await res.json();
            const results = [];
            for (const item of items) {
                if (item.type === "dir" && item.name !== "assets" && item.name !== "node_modules") {
                    const sub = await listDir(item.path);
                    results.push(...sub);
                } else if (item.type === "file" && (item.name.endsWith(".tsx") || item.name.endsWith(".ts"))) {
                    results.push({ path: item.path, download_url: item.download_url, size: item.size });
                }
            }
            return results;
        }

        const allFiles = await listDir("src");

        // First get key files, then add any other .tsx/.ts files up to reasonable count
        const keyResults = [];
        const otherResults = [];
        for (const f of allFiles) {
            if (KEY_FILES.includes(f.path)) {
                keyResults.push(f);
            } else {
                otherResults.push(f);
            }
        }

        const toFetch = [...keyResults, ...otherResults].slice(0, 25);

        const results = await Promise.all(toFetch.map(async (f) => {
            if (f.size > 80000) return { path: f.path, content: `[SKIPPED: ${f.size} bytes]` };
            const res = await fetch(f.download_url, { headers });
            const text = res.ok ? await res.text() : `[ERROR: ${res.status}]`;
            return { path: f.path, content: text };
        }));

        return Response.json({ count: results.length, files: results });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});