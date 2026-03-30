/**
 * GitHub API 相关工具
 * 前端通过 repo_url 直接查询仓库/提交信息
 */

function parseRepoUrl(repoUrl) {
    if (!repoUrl || typeof repoUrl !== 'string') return null;
    try {
        const url = new URL(repoUrl);
        if (url.hostname !== 'github.com') return null;

        const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
        if (parts.length < 2) return null;

        const owner = parts[0];
        const repo = parts[1].replace(/\.git$/i, '');
        if (!owner || !repo) return null;
        return { owner, repo };
    } catch {
        return null;
    }
}

async function githubFetchJson(apiUrl) {
    const res = await fetch(apiUrl, {
        headers: {
            'Accept': 'application/vnd.github+json'
        }
    });
    if (!res.ok) {
        const err = new Error(`GitHub API 请求失败: ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return await res.json();
}

/**
 * 获取某个文件路径的提交信息（用于“最后更新/贡献者”）
 * @param {{owner: string, repo: string}} repo
 * @param {{branch: string, path: string}} args
 */
export async function fetchFileCommits(repo, args) {
    const { owner, repo: repoName } = repo;
    const { branch, path } = args;

    const apiUrl = new URL(`https://api.github.com/repos/${owner}/${repoName}/commits`);
    apiUrl.searchParams.set('per_page', '30');
    if (branch) apiUrl.searchParams.set('sha', branch);
    if (path) apiUrl.searchParams.set('path', path);

    return await githubFetchJson(apiUrl.toString());
}

export { parseRepoUrl };

