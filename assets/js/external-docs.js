/**
 * 外部文档挂载模块
 * - 支持 path_json 模式
 * - 支持 github_tree 模式
 */
import config from './validated-config.js';

const externalResolvers = new Map();
const githubContentsCache = new Map();
const externalGitMetas = new Map();

function normalizeMountPath(input) {
    return String(input || '').trim().replace(/^\/+|\/+$/g, '');
}

function buildVirtualPath(mountPath, relativePath) {
    const cleanRel = String(relativePath || '').replace(/^\/+/, '');
    if (!mountPath) return cleanRel;
    return `${mountPath}/${cleanRel}`.replace(/\/+/g, '/');
}

function joinUrl(baseUrl, relativePath) {
    const normalizedBase = String(baseUrl || '').replace(/\/+$/, '') + '/';
    return new URL(String(relativePath || '').replace(/^\/+/, ''), normalizedBase).toString();
}

function toInlineMarkdownUrl(markdown) {
    return `data:text/plain;charset=utf-8,${encodeURIComponent(markdown)}`;
}

function setResolver(virtualPath, url) {
    externalResolvers.set(virtualPath, url);
}

function setGitMeta(virtualPath, meta) {
    externalGitMetas.set(virtualPath, meta);
}

function findNodeByPath(rootNode, targetPath) {
    if (!rootNode) return null;
    if ((rootNode.path || '') === targetPath) return rootNode;
    for (const child of (rootNode.children || [])) {
        const found = findNodeByPath(child, targetPath);
        if (found) return found;
    }
    return null;
}

function mergeTreeInto(targetNode, sourceNode) {
    if (!targetNode || !sourceNode) return;

    if (!targetNode.index && sourceNode.index) {
        targetNode.index = sourceNode.index;
    }

    if (!Array.isArray(targetNode.children)) {
        targetNode.children = [];
    }

    for (const sourceChild of (sourceNode.children || [])) {
        const samePathChild = targetNode.children.find(x => x.path === sourceChild.path);
        if (!samePathChild) {
            targetNode.children.push(sourceChild);
            continue;
        }

        const sourceIsDir = Array.isArray(sourceChild.children) && (sourceChild.children.length > 0 || !!sourceChild.index);
        const targetIsDir = Array.isArray(samePathChild.children) && (samePathChild.children.length > 0 || !!samePathChild.index);
        if (sourceIsDir && targetIsDir) {
            mergeTreeInto(samePathChild, sourceChild);
        }
        // 同路径同级冲突时保留既有节点，不覆盖
    }
}

function getNameWithoutExt(name) {
    return name.replace(/\.[^.]+$/, '');
}

function getTitleFromPathLike(pathLike) {
    const raw = String(pathLike || '').split('/').pop() || '';
    return getNameWithoutExt(raw);
}

function isSupportedDoc(fileName) {
    const ext = '.' + String(fileName).split('.').pop().toLowerCase();
    return config.document.supported_extensions.some(x => x.toLowerCase() === ext);
}

function isIndexPage(fileName) {
    const lower = String(fileName).toLowerCase();
    return config.document.index_pages.some(name => name.toLowerCase() === lower);
}

function pickIndexFile(files) {
    for (const indexName of config.document.index_pages) {
        const hit = files.find(file => file.name.toLowerCase() === indexName.toLowerCase());
        if (hit) return hit;
    }
    return null;
}

function prefixStructureAndBuildResolvers(
    rootStructure,
    mountPath,
    resolveOriginalToUrl,
    mountTitle,
    onMapPath = null,
    getSourceUrl = null
) {
    function walk(node, isRoot = false) {
        const nodeOriginalPath = String(node.path || '').replace(/^\/+/, '');
        const output = {
            title: isRoot ? (mountTitle || node.title || mountPath) : (node.title || getTitleFromPathLike(node.path)),
            path: isRoot ? mountPath : buildVirtualPath(mountPath, String(node.path || '')),
            children: []
        };
        if (typeof getSourceUrl === 'function') {
            output.external_source_url = getSourceUrl(nodeOriginalPath, true);
        }

        if (node.index && node.index.path) {
            const originalIndexPath = String(node.index.path).replace(/^\/+/, '');
            const virtualIndexPath = buildVirtualPath(mountPath, originalIndexPath);
            output.index = {
                title: node.index.title || getTitleFromPathLike(originalIndexPath),
                path: virtualIndexPath,
                ...(typeof getSourceUrl === 'function' ? { external_source_url: getSourceUrl(originalIndexPath, false) } : {})
            };
            setResolver(virtualIndexPath, resolveOriginalToUrl(originalIndexPath));
            if (typeof onMapPath === 'function') {
                onMapPath(originalIndexPath, virtualIndexPath);
            }
        } else {
            output.index = null;
        }

        for (const child of (node.children || [])) {
            const isDirLike = Array.isArray(child.children) || !!child.index;
            if (isDirLike) {
                output.children.push(walk(child, false));
                continue;
            }

            const originalPath = String(child.path || '').replace(/^\/+/, '');
            const virtualPath = buildVirtualPath(mountPath, originalPath);
            output.children.push({
                title: child.title || getTitleFromPathLike(originalPath),
                path: virtualPath,
                children: [],
                ...(typeof getSourceUrl === 'function' ? { external_source_url: getSourceUrl(originalPath, false) } : {})
            });
            setResolver(virtualPath, resolveOriginalToUrl(originalPath));
            if (typeof onMapPath === 'function') {
                onMapPath(originalPath, virtualPath);
            }
        }

        return output;
    }

    return walk(rootStructure, true);
}

async function loadPathJsonMount(mountPath, sourceUrl, mountTitle, onMapPath = null) {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
        throw new Error(`加载外部 path.json 失败: ${res.status}`);
    }

    const structure = await res.json();
    const baseUrl = sourceUrl.substring(0, sourceUrl.lastIndexOf('/'));
    return prefixStructureAndBuildResolvers(
        structure,
        mountPath,
        (originalPath) => joinUrl(baseUrl, originalPath),
        mountTitle,
        onMapPath,
        (originalPath, isDirectory) => {
            if (isDirectory) return sourceUrl;
            return joinUrl(baseUrl, originalPath);
        }
    );
}

function parseGithubTreeUrl(githubTreeUrl) {
    try {
        const url = new URL(githubTreeUrl);
        if (url.hostname !== 'github.com') return null;
        const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
        // /owner/repo/tree/branch/path...
        if (parts.length < 4 || parts[2] !== 'tree') return null;
        const owner = parts[0];
        const repo = parts[1];
        const branch = parts[3];
        const dirPath = parts.slice(4).join('/');
        if (!owner || !repo || !branch) return null;
        return { owner, repo, branch, dirPath };
    } catch {
        return null;
    }
}

async function fetchGithubContents(owner, repo, branch, dirPath) {
    const key = `${owner}/${repo}@${branch}:${dirPath}`;
    if (githubContentsCache.has(key)) {
        return githubContentsCache.get(key);
    }

    const api = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${dirPath}`);
    api.searchParams.set('ref', branch);
    const res = await fetch(api.toString(), {
        headers: { 'Accept': 'application/vnd.github+json' }
    });
    if (!res.ok) {
        throw new Error(`GitHub API 错误: ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
        throw new Error('GitHub contents 返回不是目录列表');
    }
    githubContentsCache.set(key, data);
    return data;
}

async function buildGithubTreeMount(mountPath, mountTitle, githubTreeUrl) {
    const parsed = parseGithubTreeUrl(githubTreeUrl);
    if (!parsed) {
        throw new Error('GitHub tree 链接格式无效');
    }

    const { owner, repo, branch, dirPath } = parsed;
    const repoUrl = `https://github.com/${owner}/${repo}`;
    const normalizeRepoPath = (p) => String(p || '').replace(/^\/+|\/+$/g, '');
    const joinRepoPath = (base, rel) => {
        const b = normalizeRepoPath(base);
        const r = normalizeRepoPath(rel);
        if (!b) return r;
        if (!r) return b;
        return `${b}/${r}`;
    };
    const rootList = await fetchGithubContents(owner, repo, branch, dirPath);

    // 若根目录存在 path.json，优先使用
    const pathJsonItem = rootList.find(item => item.type === 'file' && String(item.name).toLowerCase() === 'path.json');
    if (pathJsonItem && pathJsonItem.download_url) {
        return await loadPathJsonMount(
            mountPath,
            pathJsonItem.download_url,
            mountTitle,
            (originalPath, virtualPath) => {
                const repoFilePath = joinRepoPath(dirPath, originalPath);
                setGitMeta(virtualPath, { repoUrl, owner, repo, branch, filePath: repoFilePath });
            }
        );
    }

    async function walkDir(currentDirPath, virtualBasePath, displayTitle, isRoot = false) {
        const entries = await fetchGithubContents(owner, repo, branch, currentDirPath);
        const dirs = entries.filter(e => e.type === 'dir').sort((a, b) => a.name.localeCompare(b.name));
        const docs = entries
            .filter(e => e.type === 'file' && isSupportedDoc(e.name))
            .sort((a, b) => a.name.localeCompare(b.name));

        const node = {
            title: displayTitle,
            path: virtualBasePath,
            children: [],
            index: null,
            external_source_url: `https://github.com/${owner}/${repo}/tree/${branch}/${currentDirPath}`
        };

        const indexFile = pickIndexFile(docs);
        if (indexFile) {
            const relPath = (currentDirPath ? `${currentDirPath}/` : '') + indexFile.name;
            const virtualIndexPath = buildVirtualPath(mountPath, relPath);
            node.index = {
                title: getNameWithoutExt(indexFile.name),
                path: virtualIndexPath,
                external_source_url: `https://github.com/${owner}/${repo}/blob/${branch}/${relPath}`
            };
            if (indexFile.download_url) {
                setResolver(virtualIndexPath, indexFile.download_url);
                setGitMeta(virtualIndexPath, { repoUrl, owner, repo, branch, filePath: relPath });
            }
        }

        for (const file of docs) {
            if (indexFile && file.name === indexFile.name) continue;
            const relPath = (currentDirPath ? `${currentDirPath}/` : '') + file.name;
            const virtualPath = buildVirtualPath(mountPath, relPath);
            node.children.push({
                title: getNameWithoutExt(file.name),
                path: virtualPath,
                children: [],
                external_source_url: `https://github.com/${owner}/${repo}/blob/${branch}/${relPath}`
            });
            if (file.download_url) {
                setResolver(virtualPath, file.download_url);
                setGitMeta(virtualPath, { repoUrl, owner, repo, branch, filePath: relPath });
            }
        }

        for (const dir of dirs) {
            const nextDirPath = dir.path;
            const virtualDirPath = buildVirtualPath(mountPath, nextDirPath);
            const childDirNode = await walkDir(nextDirPath, virtualDirPath, dir.name, false);
            if ((childDirNode.children && childDirNode.children.length > 0) || childDirNode.index) {
                node.children.push(childDirNode);
            }
        }

        if (isRoot) {
            node.title = mountTitle || displayTitle;
            node.path = mountPath;
        }
        return node;
    }

    const rootTitle = mountTitle || mountPath;
    return await walkDir(dirPath, mountPath, rootTitle, true);
}

function createFailureNode(mountPath, mountTitle, message, sourceUrl = '') {
    const virtualPath = buildVirtualPath(mountPath, 'README.md');
    const markdown = `# ${mountTitle || mountPath}\n\n外部文档挂载失败。\n\n${message}\n`;
    setResolver(virtualPath, toInlineMarkdownUrl(markdown));
    return {
        title: mountTitle || mountPath,
        path: mountPath,
        ...(sourceUrl ? { external_source_url: sourceUrl } : {}),
        children: [],
        index: {
            title: mountTitle || mountPath,
            path: virtualPath,
            ...(sourceUrl ? { external_source_url: sourceUrl } : {})
        }
    };
}

export async function loadExternalDocsIntoPathData(basePathData, activeBranch) {
    externalResolvers.clear();
    externalGitMetas.clear();

    const docs = config.document?.external_docs;
    if (!Array.isArray(docs) || docs.length === 0) {
        return basePathData;
    }

    // 仅默认分支挂载
    if (activeBranch !== config.document.default_branch) {
        return basePathData;
    }

    if (!basePathData.children || !Array.isArray(basePathData.children)) {
        basePathData.children = [];
    }

    for (const item of docs) {
        const hasMountPathConfig = Object.prototype.hasOwnProperty.call(item || {}, 'mount_path');
        const mountPath = normalizeMountPath(item?.mount_path);
        const mode = item?.mode;
        const sourceUrl = item?.url;
        const title = item?.title || mountPath || '外部文档';

        if (!hasMountPathConfig || !mode || !sourceUrl) continue;

        try {
            let mountNode = null;
            if (mode === 'path_json') {
                mountNode = await loadPathJsonMount(mountPath, sourceUrl, title);
            } else if (mode === 'github_tree') {
                mountNode = await buildGithubTreeMount(mountPath, title, sourceUrl);
            }

            if (mountNode) {
                // 根路径挂载：直接合并到根节点，不创建额外目录
                if (!mountPath) {
                    mergeTreeInto(basePathData, mountNode);
                    continue;
                }

                const existingNode = findNodeByPath(basePathData, mountPath);
                if (existingNode && existingNode !== mountNode) {
                    // 已有路径：合并而非覆盖
                    mergeTreeInto(existingNode, mountNode);
                } else if (!existingNode) {
                    // 不存在：新增挂载节点
                    basePathData.children.push(mountNode);
                }
            }
        } catch (e) {
            const failNode = createFailureNode(mountPath, title, String(e?.message || e), sourceUrl);
            if (!mountPath) {
                mergeTreeInto(basePathData, failNode);
            } else {
                const existingNode = findNodeByPath(basePathData, mountPath);
                if (existingNode) {
                    mergeTreeInto(existingNode, failNode);
                } else {
                    basePathData.children.push(failNode);
                }
            }
        }
    }

    return basePathData;
}

export function resolveExternalDocumentUrl(relativePath) {
    return externalResolvers.get(relativePath) || null;
}

export function isExternalDocumentPath(relativePath) {
    return externalResolvers.has(relativePath);
}

export function resolveExternalGitMeta(relativePath) {
    return externalGitMetas.get(relativePath) || null;
}

