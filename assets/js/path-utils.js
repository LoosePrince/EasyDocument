/**
 * 路径工具模块
 * 确保所有路径都正确使用 base_url 配置
 */
import config from './validated-config.js';

/**
 * 获取当前的文档分支
 * @returns {string} 当前分支名称
 */
export function getCurrentBranch() {
    if (!config.document.branch_support) {
        return config.document.default_branch || 'main';
    }

    // 从哈希中解析分支
    const hash = window.location.hash.substring(1); // 移除开头的#
    if (!hash) {
        return config.document.default_branch || 'main';
    }

    // 哈希格式: #branch/#path 或 #/path (默认分支)
    // 根据用户要求，通过#的数量区分，这里逻辑上是找第一个/#
    if (hash.includes('/#')) {
        const parts = hash.split('/#');
        if (parts[0] && !parts[0].startsWith('/')) {
            return parts[0];
        }
    }

    return config.document.default_branch || 'main';
}

/**
 * 获取分支对应的数据根路径
 * @param {string} branch 分支名称（可选，默认当前分支）
 * @returns {string} 数据根路径
 */
export function getBranchDataPath(branch = null) {
    const currentBranch = branch || getCurrentBranch();
    const rootDir = config.document.root_dir.replace(/\/$/, '');
    
    if (!config.document.branch_support) {
        return rootDir;
    }
    
    return `${rootDir}/${currentBranch}`;
}

/**
 * 获取完整的站点路径
 * @param {string} relativePath 相对路径
 * @returns {string} 完整路径
 */
export function getFullPath(relativePath = '') {
    const baseUrl = config.site.base_url.replace(/\/$/, ''); // 移除末尾斜杠
    const cleanPath = relativePath.replace(/^\//, ''); // 移除开头斜杠
    
    if (!cleanPath) {
        return baseUrl || '/';
    }
    
    return baseUrl ? `${baseUrl}/${cleanPath}` : `/${cleanPath}`;
}

/**
 * 获取文档页面的完整路径
 * @param {string} hash 哈希部分（可选）
 * @returns {string} 文档页面完整路径
 */
export function getDocumentPagePath(hash = '') {
    const fullPath = getFullPath('main/');
    return hash ? `${fullPath}${hash}` : fullPath;
}

/**
 * 获取静态资源的完整路径
 * @param {string} assetPath 资源相对路径
 * @returns {string} 资源完整路径
 */
export function getAssetPath(assetPath) {
    return getFullPath(assetPath);
}

/**
 * 从哈希中解析路径、根目录、分支和锚点
 * @param {string} hash 哈希字符串 (默认当前 location.hash)
 * @returns {Object} 解析后的路径信息 { branch, path, root, anchor }
 */
export function parseUrlPath(hash = window.location.hash) {
    let hashStr = decodeURIComponent(hash.startsWith('#') ? hash.substring(1) : hash);
    
    const result = {
        branch: config.document.default_branch || 'main',
        path: '',
        root: null,
        anchor: ''
    };

    if (!hashStr) return result;

    // 处理分支: #branch/#/path
    if (config.document.branch_support && hashStr.includes('/#')) {
        const parts = hashStr.split('/#');
        if (parts[0] && !parts[0].startsWith('/')) {
            result.branch = parts[0];
            hashStr = parts[1]; // 剩余部分作为路径和锚点
            if (!hashStr.startsWith('/')) {
                hashStr = '/' + hashStr;
            }
        }
    }

    // 分离锚点
    const anchorIndex = hashStr.indexOf('#');
    if (anchorIndex !== -1) {
        result.anchor = hashStr.substring(anchorIndex + 1);
        hashStr = hashStr.substring(0, anchorIndex);
    }

    // 解析 path 和 root
    if (hashStr.startsWith('/')) {
        // #/path/to/file
        result.path = hashStr.substring(1);
    } else {
        // #root/path/to/file
        const slashIndex = hashStr.indexOf('/');
        if (slashIndex !== -1) {
            result.root = hashStr.substring(0, slashIndex);
            result.path = hashStr.substring(slashIndex + 1);
        } else {
            result.root = hashStr;
            result.path = '';
        }
    }

    return result;
}

/**
 * 生成新格式的文档URL
 * @param {string} path 文档路径
 * @param {string} root 根目录（可选）
 * @param {string} anchor 锚点（可选）
 * @param {string} branch 分支（可选，默认当前分支）
 * @returns {string} 新格式URL
 */
export function generateNewUrl(path, root = null, anchor = '', branch = null) {
    const baseUrl = getDocumentPagePath();
    const currentBranch = branch || getCurrentBranch();
    const isDefaultBranch = currentBranch === config.document.default_branch;
    
    // 移除扩展名的函数
    const removeExtension = (filePath) => {
        if (!filePath) return filePath;
        return filePath.replace(/\.(md|html)$/i, '');
    };
    
    // 构建路径hash部分
    let pathHash = '';
    
    if (root) {
        let relativePath = path;
        if (path && path.startsWith(root + '/')) {
            relativePath = path.substring(root.length + 1);
        }
        relativePath = removeExtension(relativePath);
        pathHash = root;
        if (relativePath) {
            pathHash += '/' + relativePath;
        }
    } else {
        if (path) {
            pathHash = '/' + removeExtension(path);
        }
    }

    if (anchor) {
        pathHash += '#' + anchor;
    }

    // 构建最终哈希
    let finalHash = '';
    if (config.document.branch_support && !isDefaultBranch) {
        // 非默认分支: #branch/#path
        finalHash = `#${currentBranch}/#${pathHash}`;
    } else {
        // 默认分支或不启用分支: #path
        finalHash = `#${pathHash}`;
    }
    
    return baseUrl + finalHash;
}
