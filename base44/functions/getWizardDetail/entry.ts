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

        async function fetchFile(path) {
            const res = await fetch(`${base}/${path}`, { headers });
            if (!res.ok) return { path, error: `HTTP ${res.status}` };
            const info = await res.json();
            const cRes = await fetch(info.download_url, { headers });
            return { path, size: info.size, content: await cRes.text() };
        }

        const results = await Promise.all([
            fetchFile("src/components/FormWizard.tsx"),
            fetchFile("src/types/form.ts"),
            fetchFile("src/components/forms/CompanyDataForm.tsx"),
            fetchFile("src/components/forms/RuleConfigurationForm.tsx"),
        ]);

        return Response.json({ files: results });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});