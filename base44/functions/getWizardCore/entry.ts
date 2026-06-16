import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const FILES = [
    "src/contexts/FormContext.tsx",
    "src/components/FormWizard.tsx",
    "src/hooks/useFormPersistence.ts",
    "src/components/WizardStep.tsx",
    "src/components/StepIndicator.tsx",
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

        const results = await Promise.all(FILES.map(async (filePath) => {
            const res = await fetch(`${base}/${filePath}`, { headers });
            if (!res.ok) return { path: filePath, error: `HTTP ${res.status}` };
            const fileInfo = await res.json();
            if (fileInfo.size > 150000) return { path: filePath, error: `Too large: ${fileInfo.size}b` };
            const contentRes = await fetch(fileInfo.download_url, { headers });
            const content = await contentRes.text();
            return { path: filePath, size: fileInfo.size, content };
        }));

        return Response.json({ files: results });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});