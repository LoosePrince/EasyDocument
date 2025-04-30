/**
 * 文档缓存管理模块
 * 负责处理文档的预加载和缓存功能
 */

// 全局缓存对象
const documentCache = {
    // 存储缓存的文档内容（持久化到localStorage）
    cache: {},
    
    // 存储预加载的文档内容（只在内存中，刷新后丢失）
    preloadCache: {},
    
    // 缓存时间设置（10分钟）
    cacheTime: 10 * 60 * 1000,
    
    // 正在预加载的文档
    loadingDocs: new Set(),
    
    /**
     * 获取文档内容（先检查预加载缓存，再检查持久缓存）
     * @param {string} path 文档路径
     * @returns {string|null} 文档内容或null
     */
    get(path) {
        // 先检查预加载缓存
        if (this.preloadCache[path]) {
            console.log(`从预加载缓存获取文档: ${path}`);
            return this.preloadCache[path];
        }
        
        // 再检查持久缓存
        const cachedDoc = this.cache[path];
        if (cachedDoc) {
            // 检查缓存是否过期
            const now = Date.now();
            if (now - cachedDoc.timestamp < this.cacheTime) {
                console.log(`从持久缓存获取文档: ${path}`);
                return cachedDoc.content;
            }
            
            // 缓存已过期，删除
            delete this.cache[path];
            this._saveToLocalStorage();
        }
        
        return null;
    },
    
    /**
     * 将文档内容设置到持久缓存
     * @param {string} path 文档路径
     * @param {string} content 文档内容
     */
    set(path, content) {
        this.cache[path] = {
            content: content,
            timestamp: Date.now()
        };
        
        // 保存到localStorage
        this._saveToLocalStorage();
    },
    
    /**
     * 将文档内容设置到预加载缓存（仅内存中）
     * @param {string} path 文档路径
     * @param {string} content 文档内容
     */
    setPreloaded(path, content) {
        this.preloadCache[path] = content;
        this.loadingDocs.delete(path);
    },
    
    /**
     * 获取所有缓存的文档路径（包括预加载和持久缓存）
     * @returns {string[]} 缓存的文档路径数组
     */
    getAllCachedPaths() {
        // 合并预加载和持久缓存的路径
        return [...new Set([
            ...Object.keys(this.cache),
            ...Object.keys(this.preloadCache)
        ])];
    },
    
    /**
     * 获取所有持久缓存的文档路径
     * @returns {string[]} 持久缓存的文档路径数组
     */
    getPersistentCachedPaths() {
        return Object.keys(this.cache);
    },
    
    /**
     * 获取所有预加载的文档路径
     * @returns {string[]} 预加载的文档路径数组
     */
    getPreloadedPaths() {
        return Object.keys(this.preloadCache);
    },
    
    /**
     * 检查文档是否在预加载缓存中
     * @param {string} path 文档路径
     * @returns {boolean} 是否在预加载缓存中
     */
    isPreloaded(path) {
        return !!this.preloadCache[path];
    },
    
    /**
     * 检查文档是否在持久缓存中
     * @param {string} path 文档路径
     * @returns {boolean} 是否在持久缓存中
     */
    isCached(path) {
        return !!this.cache[path];
    },
    
    /**
     * 清理过期的缓存
     */
    clearExpired() {
        const now = Date.now();
        
        for (const path in this.cache) {
            // 检查是否过期
            if (now - this.cache[path].timestamp > this.cacheTime) {
                delete this.cache[path];
            }
        }
        
        // 更新localStorage
        this._saveToLocalStorage();
    },
    
    /**
     * 清理所有持久缓存
     */
    clearAllCache() {
        this.cache = {};
        localStorage.removeItem('document_cache');
        localStorage.removeItem('document_cache_info');
    },
    
    /**
     * 清理所有预加载缓存
     */
    clearAllPreloaded() {
        this.preloadCache = {};
    },
    
    /**
     * 清理所有缓存（预加载和持久缓存）
     */
    clearAll() {
        this.clearAllCache();
        this.clearAllPreloaded();
    },
    
    /**
     * 从path.json自动预加载文档
     * @param {Object} pathData 文档路径数据
     * @param {number} maxPreload 最大预加载数量
     */
    autoPreloadDocuments(pathData, maxPreload = 10) {
        if (!pathData) return;
        
        // 收集所有文档路径
        const allPaths = [];
        
        // 递归遍历文档结构
        const collectPaths = (node, currentPath = '') => {
            // 处理索引文档
            if (node.index && node.index.path) {
                allPaths.push(node.index.path);
            }
            
            // 处理叶子节点
            if (node.path && !node.children && node.path.includes('.')) {
                allPaths.push(node.path);
            }
            
            // 递归处理子节点
            if (node.children && Array.isArray(node.children)) {
                node.children.forEach(child => {
                    collectPaths(child);
                });
            }
        };
        
        collectPaths(pathData);
        
        // 过滤掉已加载和已预加载的文档
        const pathsToPreload = allPaths.filter(path => 
            !this.cache[path] && 
            !this.preloadCache[path] && 
            !this.loadingDocs.has(path)
        );
        
        // 限制预加载数量
        const limitedPaths = pathsToPreload.slice(0, maxPreload);
        
        console.log(`准备预加载 ${limitedPaths.length} 个文档:`, limitedPaths);
        
        // 开始预加载
        limitedPaths.forEach(path => {
            this.preloadDocument(path);
        });
    },
    
    /**
     * 预加载单个文档
     * @param {string} path 文档路径
     */
    preloadDocument(path) {
        // 标记为正在加载
        this.loadingDocs.add(path);
        
        // 构建完整路径
        const fetchPath = `data/${path}`;
        
        fetch(fetchPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`预加载失败: ${response.status}`);
                }
                return response.text();
            })
            .then(content => {
                // 将内容存储到预加载缓存
                this.setPreloaded(path, content);
                console.log(`文档预加载成功: ${path}`);
            })
            .catch(error => {
                // 移除标记
                this.loadingDocs.delete(path);
                console.error(`文档预加载失败: ${path}`, error);
            });
    },
    
    /**
     * 将缓存信息保存到localStorage
     * @private
     */
    _saveToLocalStorage() {
        try {
            // 创建缓存信息对象
            const cacheData = {};
            for (const path in this.cache) {
                cacheData[path] = {
                    content: this.cache[path].content,
                    timestamp: this.cache[path].timestamp
                };
            }
            
            // 保存到localStorage (分片存储避免超过大小限制)
            const cacheString = JSON.stringify(cacheData);
            const chunkSize = 500000; // 约500KB一片
            const chunks = Math.ceil(cacheString.length / chunkSize);
            
            // 先清除旧的缓存数据
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('document_cache_chunk_')) {
                    localStorage.removeItem(key);
                }
            }
            
            // 记录缓存信息
            localStorage.setItem('document_cache_info', JSON.stringify({
                timestamp: Date.now(),
                chunks: chunks,
                paths: Object.keys(this.cache)
            }));
            
            // 分片存储内容
            for (let i = 0; i < chunks; i++) {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, cacheString.length);
                const chunk = cacheString.substring(start, end);
                localStorage.setItem(`document_cache_chunk_${i}`, chunk);
            }
        } catch (e) {
            console.error('保存缓存信息到localStorage失败:', e);
        }
    },
    
    /**
     * 从localStorage加载缓存信息
     * @private
     */
    _loadFromLocalStorage() {
        try {
            // 检查缓存信息
            const cacheInfoStr = localStorage.getItem('document_cache_info');
            if (!cacheInfoStr) return;
            
            const cacheInfo = JSON.parse(cacheInfoStr);
            if (!cacheInfo || !cacheInfo.chunks) return;
            
            // 从分片中还原缓存数据
            let cacheString = '';
            for (let i = 0; i < cacheInfo.chunks; i++) {
                const chunkKey = `document_cache_chunk_${i}`;
                const chunk = localStorage.getItem(chunkKey);
                if (chunk) {
                    cacheString += chunk;
                } else {
                    console.warn(`缓存分片 ${i} 未找到`);
                }
            }
            
            // 解析缓存数据
            if (cacheString) {
                const cacheData = JSON.parse(cacheString);
                this.cache = cacheData;
                console.log(`从localStorage加载了 ${Object.keys(this.cache).length} 个缓存文档`);
            }
        } catch (e) {
            console.error('从localStorage加载缓存信息失败:', e);
            // 出错时清除可能损坏的缓存
            this.clearAllCache();
        }
    },
    
    /**
     * 初始化缓存管理器
     */
    init() {
        // 从localStorage加载缓存信息
        this._loadFromLocalStorage();
        
        // 清理过期缓存
        this.clearExpired();
        
        // 设置定期清理
        setInterval(() => this.clearExpired(), 5 * 60 * 1000); // 5分钟清理一次
        
        console.log(`缓存管理器初始化完成，持久缓存文档数: ${Object.keys(this.cache).length}`);
    }
};

// 初始化缓存管理器
documentCache.init();

export default documentCache; 