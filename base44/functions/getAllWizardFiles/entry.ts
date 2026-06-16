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

        async function listDir(path) {
            const res = await fetch(`${base}/${path}`, { headers });
            if (!res.ok) return [];
            const items = await res.json();
            return items.map(f => ({ name: f.name, type: f.type, path: f.path }));
        }

        const filesToFetch = [
            "src/components/FormWizard.tsx",
            "src/components/FormNavigation.tsx",
            "src/components/StepHeader.tsx",
        ];

        const [formsDir, enhancedDir, ...fileResults] = await Promise.all([
            listDir("src/components/forms"),
            listDir("src/components/enhanced"),
            ...filesToFetch.map(async (path) => {
                const res = await fetch(`${base}/${path}`, { headers });
                if (!res.ok) return { path, error: `HTTP ${res.status}` };
                const info = await res.json();
                const cRes = await fetch(info.download_url, { headers });
                return { path, size: info.size, content: await cRes.text() };
            })
        ]);

        // Fetch all form step components
        const formFiles = [];
        for (const f of formsDir) {
            if (f.type === "file" && f.name.endsWith(".tsx")) {
                const res = await fetch(`${base}/${f.path}`, { headers });
                if (!res.ok) continue;
                const info = await res.json();
                if (info.size > 50000) { formFiles.push({ path: f.path, size: info.size, content: "[SKIPPED: too large]" }); continue; }
                const cRes = await fetch(info.download_url, { headers });
                formFiles.push({ path: f.path, size: info.size, content: await cRes.text() });
            }
        }

        const enhancedFiles = [];
        for (const f of enhancedDir) {
            if (f.type === "file" && f.name.endsWith(".tsx")) {
                const res = await fetch(`${base}/${f.path}`, { headers });
                if (!res.ok) continue;
                const info = await res.json();
                if (info.size > 50000) { enhancedFiles.push({ path: f.path, size: info.size, content: "[SKIPPED: too large]" }); continue; }
                const cRes = await fetch(info.download_url, { headers });
                enhancedFiles.push({ path: f.path, size: info.size, content: await cRes.text() });
            }
        }

        return Response.json({
            forms_dir: formsDir,
            enhanced_dir: enhancedDir,
            formFiles,
            enhancedFiles,
            mainFiles: fileResults.filter(r => !r.error),
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});