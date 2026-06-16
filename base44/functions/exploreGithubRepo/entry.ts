import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = Deno.env.get("GITHUB_ACCESS_TOKEN");
        if (!token) {
            return Response.json({ error: 'GitHub token not configured' }, { status: 500 });
        }

        const owner = "naomi-wagatsuma";
        const repo = "regra-calculo-wizard";

        // Get repo contents at root
        const rootRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/`,
            { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" } }
        );

        if (!rootRes.ok) {
            const errBody = await rootRes.text();
            return Response.json({ error: `GitHub API error ${rootRes.status}`, detail: errBody, headers_sent: Object.fromEntries(rootRes.headers) }, { status: rootRes.status });
        }

        const rootContents = await rootRes.json();

        // Recursively fetch all files
        const allFiles = [];

        async function traverse(contents) {
            for (const item of contents) {
                if (item.type === "dir") {
                    const dirRes = await fetch(item.url, {
                        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" }
                    });
                    if (dirRes.ok) {
                        const dirContents = await dirRes.json();
                        await traverse(dirContents);
                    }
                } else if (item.type === "file") {
                    allFiles.push({ path: item.path, name: item.name, download_url: item.download_url, size: item.size });
                }
            }
        }

        await traverse(rootContents);

        // Fetch content of each file (limit to reasonable size)
        const filesWithContent = [];
        for (const file of allFiles) {
            if (file.size > 500000) {
                filesWithContent.push({ ...file, content: "[FILE TOO LARGE]", skipped: true });
                continue;
            }
            const contentRes = await fetch(file.download_url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (contentRes.ok) {
                const text = await contentRes.text();
                filesWithContent.push({ ...file, content: text });
            } else {
                filesWithContent.push({ ...file, content: "[FETCH FAILED]", error: contentRes.status });
            }
        }

        return Response.json({
            repo: `${owner}/${repo}`,
            file_count: allFiles.length,
            files: filesWithContent
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});