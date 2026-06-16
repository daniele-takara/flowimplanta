import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { path } = body;
        if (!path) {
            return Response.json({ error: 'Path is required' }, { status: 400 });
        }

        const token = Deno.env.get("GITHUB_ACCESS_TOKEN");
        const owner = "naomi-wagatsuma";
        const repo = "regra-calculo-wizard";
        const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" };

        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        const infoRes = await fetch(apiUrl, { headers });
        if (!infoRes.ok) {
            return Response.json({ error: `GitHub API error: ${infoRes.status}`, path }, { status: 502 });
        }
        const info = await infoRes.json();

        if (info.size > 120000) {
            return Response.json({ path, size: info.size, content: `[FILE TOO LARGE: ${info.size} bytes]` });
        }

        const contentRes = await fetch(info.download_url, { headers });
        const text = await contentRes.text();

        return Response.json({ path, size: info.size, content: text });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});