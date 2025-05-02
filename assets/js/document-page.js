/**
 * 文档页面交互逻辑
 */
import config from '../../config.js';
import { initializeMermaid, processMermaidDiagrams } from './mermaid-handler.js';
import { processKaTeXFormulas } from './katex-handler.js';
import documentCache from './document-cache.js';

let pathData = null; // 存储文档结构数据
let currentRoot = null; // 当前根目录
let isLoadingDocument = false; // 是否正在加载文档
let progressBar = null; // 进度条元素

document.addEventListener('DOMContentLoaded', async () => {
    // 初始化Mermaid
    initializeMermaid();
    
    // 应用布局配置
    applyLayoutConfig();
    
    // 设置侧边栏粘连控制
    setupStickyBars();
    
    // 创建顶部进度条
    createProgressBar();
    
    // 加载文档结构
    try {
        const response = await fetch('path.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        pathData = await response.json();
        
        // **移除**: 不再在页面加载时自动预加载
        // documentCache.autoPreloadDocuments(pathData, 5);
    } catch (error) {
        console.error("加载 path.json 失败:", error);
        document.getElementById('sidebar-nav').innerHTML = '<p class="text-red-500">加载文档结构失败!</p>';
        document.getElementById('document-content').innerHTML = '<p class="text-red-500">加载文档结构失败!</p>';
        return;
    }
    
    // 生成侧边栏
    generateSidebar(pathData);
    
    // 监听URL变化（使用popstate替代hashchange）
    window.addEventListener('popstate', loadContentFromUrl);
    
    // 全局事件监听，确保所有内部链接都使用无刷新导航
    document.addEventListener('click', (e) => {
        // 查找最近的a标签
        const link = e.target.closest('a');
        
        // 如果是站内链接（相同域名）
        if (link && link.href && link.href.startsWith(window.location.origin)) {
            const url = new URL(link.href);
            
            // 如果链接是导航路径查询参数
            if (url.pathname === window.location.pathname) {
                e.preventDefault();
                const path = url.searchParams.get('path') || '';
                
                // 使用pushState更新URL，而不是直接改变location
                window.history.pushState({path}, '', link.href);
                
                // 手动触发内容加载
                loadContentFromUrl();
            }
        }
    });
    
    // 初始加载内容
    loadContentFromUrl();
});

// 创建顶部进度条
function createProgressBar() {
    // 创建进度条容器
    progressBar = document.createElement('div');
    progressBar.id = 'top-progress-bar';
    progressBar.className = 'fixed top-0 left-0 w-full h-1 bg-gray-200 dark:bg-gray-700 z-50 hidden';
    
    // 创建进度条内部填充
    const progressFill = document.createElement('div');
    progressFill.id = 'progress-fill';
    progressFill.className = 'h-full bg-primary transition-all duration-300 ease-out';
    progressFill.style.width = '0%';
    
    // 组装进度条
    progressBar.appendChild(progressFill);
    document.body.appendChild(progressBar);
}

// 显示进度条
function showProgressBar() {
    if (!progressBar) return;
    
    // 重置进度
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
        progressFill.style.width = '0%';
    }
    
    // 显示进度条
    progressBar.classList.remove('hidden');
    
    // 快速初始进度
    setTimeout(() => {
        if (progressFill) {
            progressFill.style.width = '30%';
        }
    }, 50);
}

// 更新进度条
function updateProgressBar(percentage) {
    if (!progressBar) return;
    
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
}

// 隐藏进度条
function hideProgressBar() {
    if (!progressBar) return;
    
    // 先完成进度
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
        progressFill.style.width = '100%';
    }
    
    // 延迟隐藏，确保动画完成
    setTimeout(() => {
        progressBar.classList.add('hidden');
    }, 300);
}

// 应用布局配置
function applyLayoutConfig() {
    const root = document.documentElement;
    root.style.setProperty('--sidebar-width', config.layout.sidebar_width);
    root.style.setProperty('--toc-width', config.layout.toc_width);
    
    const sidebar = document.getElementById('sidebar-container');
    const toc = document.getElementById('toc-container');
    const mainContent = document.getElementById('main-content-area');
    const layoutContainer = document.querySelector('.main-layout');
    
    // 更新媒体查询断点
    updateMediaQueryBreakpoint();
    
    // 添加移动端菜单按钮
    setupMobileMenu();
    
    // 返回顶部按钮配置
    const backToTopButton = document.getElementById('back-to-top');
    if (!config.navigation.back_to_top && backToTopButton) {
        backToTopButton.remove();
    }
}

// 更新媒体查询断点
function updateMediaQueryBreakpoint() {
    // 判断值是否相同
    if (config.layout.mobile_breakpoint === '768px') {
        return;
    }
    // 获取所有样式表
    const styleSheets = document.styleSheets;
    const mobileBreakpoint = config.layout.mobile_breakpoint;
    
    // 遍历所有样式表
    for (let i = 0; i < styleSheets.length; i++) {
        const styleSheet = styleSheets[i];
        
        try {
            // 获取所有CSS规则
            const cssRules = styleSheet.cssRules || styleSheet.rules;
            if (!cssRules) continue;
            
            // 遍历所有规则
            for (let j = 0; j < cssRules.length; j++) {
                const rule = cssRules[j];
                
                // 检查是否是媒体查询规则
                if (rule instanceof CSSMediaRule) {
                    const mediaText = rule.conditionText || rule.media.mediaText;
                    
                    // 检查是否包含 max-width: 768px
                    if (mediaText.includes('max-width: 768px')) {
                        // 删除旧的媒体查询规则
                        styleSheet.deleteRule(j);
                        
                        // 创建新的媒体查询文本
                        const newMediaText = mediaText.replace('768px', mobileBreakpoint);
                        
                        // 获取原规则的CSS文本
                        let cssText = '';
                        for (let k = 0; k < rule.cssRules.length; k++) {
                            cssText += rule.cssRules[k].cssText;
                        }
                        
                        // 插入新的媒体查询规则
                        styleSheet.insertRule(`@media ${newMediaText} { ${cssText} }`, j);
                        
                        // 由于删除和插入操作会影响索引，需要调整j
                        j--;
                    }
                }
            }
        } catch (error) {
            // 跨域样式表会抛出安全错误，忽略它们
            continue;
        }
    }
}

// 设置侧边栏粘连控制，确保不会覆盖底栏
function setupStickyBars() {
    const sidebarContainer = document.getElementById('sidebar-container');
    const tocContainer = document.getElementById('toc-container');
    const mainContent = document.getElementById('main-content-area');
    const mainLayout = document.querySelector('.main-layout');
    
    // 如果元素不存在，直接返回
    if (!sidebarContainer || !tocContainer || !mainContent || !mainLayout) {
        return;
    }
    
    // 滚动事件处理函数
    function handleScroll() {
        // 检查当前屏幕宽度，如果是移动设备则不应用粘连效果
        const isMobile = window.innerWidth <= parseInt(config.layout.mobile_breakpoint);
        if (isMobile) return;
        
        // 获取主内容区位置和尺寸
        const mainRect = mainContent.getBoundingClientRect();
        const mainBottom = mainRect.bottom;
        const mainHeight = mainContent.offsetHeight;
        
        // 获取主布局位置和尺寸
        const layoutRect = mainLayout.getBoundingClientRect();
        const layoutTop = layoutRect.top;
        
        // 获取侧边栏的高度
        const sidebarHeight = sidebarContainer.offsetHeight;
        const tocHeight = tocContainer.offsetHeight;
        
        // 获取窗口高度
        const windowHeight = window.innerHeight;
        
        // 计算侧边栏底部相对于视口的位置
        const sidebarContainerBottom = 20 + sidebarHeight; // 顶部margin(20px) + 侧边栏高度
        const tocContainerBottom = 20 + tocHeight;
        
        // 如果主内容区底部已进入视口且低于侧边栏底部
        if (mainBottom < windowHeight && sidebarContainerBottom > mainBottom) {
            // 调整侧边栏，使其底部对齐主内容区底部
            
            // 计算侧边栏应该的top值
            // 主内容区底部位置 - 侧边栏高度 
            const sidebarTop = mainBottom - sidebarHeight;
            const tocTop = mainBottom - tocHeight;
            
            if (sidebarTop > 20) { // 确保不高于粘连起始位置
                sidebarContainer.style.position = 'fixed';
                sidebarContainer.style.top = `${sidebarTop}px`;
                sidebarContainer.style.bottom = 'auto';
            }
            
            if (tocTop > 20) { // 确保不高于粘连起始位置
                tocContainer.style.position = 'fixed';
                tocContainer.style.top = `${tocTop}px`;
                tocContainer.style.bottom = 'auto';
            }
        } else {
            // 恢复粘性定位
            sidebarContainer.style.position = 'sticky';
            tocContainer.style.position = 'sticky';
            sidebarContainer.style.top = '20px';
            tocContainer.style.top = '20px';
            sidebarContainer.style.bottom = 'auto';
            tocContainer.style.bottom = 'auto';
        }
    }
    
    // 使用 ResizeObserver 监听主内容高度变化
    const resizeObserver = new ResizeObserver(debounce(() => {
        handleScroll();
    }, 100));
    
    // 监听主内容区域大小变化
    resizeObserver.observe(mainContent);
    
    // 监听滚动事件，使用防抖处理
    window.addEventListener('scroll', debounce(handleScroll, 10));
    
    // 监听窗口大小变化，适应响应式布局
    window.addEventListener('resize', debounce(handleScroll, 200));
    
    // 初始执行一次
    setTimeout(handleScroll, 200); // 延迟执行以确保布局已完成
}

// 设置移动端菜单
function setupMobileMenu() {
    // 检查是否已经存在菜单按钮
    if (document.getElementById('mobile-menu-toggle')) {
        return;
    }
    
    // 创建移动端左侧菜单按钮（文档树）
    const menuButton = document.createElement('button');
    menuButton.id = 'mobile-menu-toggle';
    menuButton.className = 'fixed z-50 bg-white dark:bg-gray-800 text-gray-800 dark:text-white p-2 rounded-md shadow-md';
    menuButton.innerHTML = '<i class="fas fa-bars text-xl"></i>';
    document.body.appendChild(menuButton);
    
    // 创建移动端右侧目录按钮（TOC）
    const tocButton = document.createElement('button');
    tocButton.id = 'toc-toggle';
    tocButton.className = 'md:hidden';
    tocButton.innerHTML = '<i class="fas fa-list-ul"></i>';
    document.body.appendChild(tocButton);
    
    // 创建遮罩层
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
    
    const sidebar = document.getElementById('sidebar-container');
    const tocContainer = document.getElementById('toc-container');
    
    // 确保侧边栏的初始状态是正确的
    sidebar.classList.remove('active');
    tocContainer.classList.remove('active');
    
    // 左侧菜单按钮点击事件
    menuButton.addEventListener('click', () => {
        // 如果右侧目录是打开的，先关闭它
        tocContainer.classList.remove('active');
        
        // 切换左侧菜单
        sidebar.classList.toggle('active');
        backdrop.classList.toggle('active');
    });
    
    // 右侧目录按钮点击事件
    tocButton.addEventListener('click', () => {
        // 如果左侧菜单是打开的，先关闭它
        sidebar.classList.remove('active');
        menuButton.querySelector('i').className = 'fas fa-bars text-xl';
        
        // 切换右侧目录
        tocContainer.classList.toggle('active');
        backdrop.classList.toggle('active');
    });
    
    // 点击遮罩层关闭所有菜单
    backdrop.addEventListener('click', () => {
        sidebar.classList.remove('active');
        tocContainer.classList.remove('active');
        backdrop.classList.remove('active');
        menuButton.querySelector('i').className = 'fas fa-bars text-xl';
    });
}

// 生成侧边栏导航
function generateSidebar(node) {
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = ''; // 清空加载中
    
    // 处理root参数
    if (currentRoot) {
        // 查找指定的根目录节点
        const rootNode = findNodeByPath(node, currentRoot);
        if (rootNode) {
            // 显示该节点下的内容
            const ul = createNavList(rootNode.children, 0);
            nav.appendChild(ul);
            
            // 添加返回完整目录的链接
            const backDiv = document.createElement('div');
            backDiv.className = 'py-2 px-3 mb-4 border-b border-gray-200 dark:border-gray-700';
            
            const backLink = document.createElement('a');
            backLink.href = 'main.html'; // 直接跳转到main.html，不带任何参数
            backLink.className = 'flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-primary';
            backLink.innerHTML = '<i class="fas fa-arrow-left mr-2"></i> 返回完整目录';
            
            backDiv.appendChild(backLink);
            nav.insertBefore(backDiv, nav.firstChild);
            
            return;
        }
    }
    
    // 没有指定root参数或root参数无效，显示完整目录
    const ul = createNavList(node.children, 0);
    nav.appendChild(ul);
}

// 根据路径查找节点
function findNodeByPath(rootNode, targetPath) {
    // 清理路径确保兼容性
    const normalizedPath = targetPath.replace(/\/+$/, '');
    
    function traverse(node, currentPath) {
        // 检查是否有索引页
        if (node.index && node.index.path) {
            const folderPath = getFolderPathFromIndexPath(node.index.path);
            if (folderPath === normalizedPath) {
                return node;
            }
        }
        
        // 递归查找子节点
        if (node.children) {
            for (const child of node.children) {
                const found = traverse(child, '');
                if (found) return found;
            }
        }
        
        return null;
    }
    
    // 特殊情况：如果目标路径是完全一样的索引文件
    function checkExactPath(node) {
        // 直接检查节点本身
        if (node.path === normalizedPath) {
            return node;
        }
        
        // 检查子节点
        if (node.children) {
            for (const child of node.children) {
                // 检查子节点是否匹配
                if (child.path === normalizedPath) {
                    return child;
                }
                
                // 递归检查
                const found = checkExactPath(child);
                if (found) return found;
            }
        }
        
        return null;
    }
    
    // 先尝试直接查找目录名称
    let result = checkExactPath(rootNode);
    if (result) return result;
    
    // 如果没找到，再尝试通过索引页路径查找
    return traverse(rootNode);
}

// 从索引页路径获取文件夹路径
function getFolderPathFromIndexPath(indexPath) {
    const parts = indexPath.split('/');
    if (parts.length > 0 && isIndexFile(parts[parts.length - 1])) {
        parts.pop();
    }
    return parts.join('/');
}

// 递归创建导航列表
function createNavList(items, level) {
    const ul = document.createElement('ul');
    ul.classList.add('nav-list', `level-${level}`);
    
    if (level > 0) {
        ul.classList.add('nested-list'); // 添加嵌套类名
        ul.style.display = 'none'; // 默认折叠
    }
    
    items.forEach(item => {
        const li = document.createElement('li');
        li.classList.add('nav-item', 'my-1');
        
        if (item.children && item.children.length > 0) {
            // 目录
            const div = document.createElement('div');
            div.classList.add('flex', 'items-center', 'cursor-pointer', 'hover:text-primary', 'dark:hover:text-primary', 'folder-title');
            div.classList.add(`folder-level-${level}`); // 添加层级类名，用于CSS控制缩进
            
            const icon = document.createElement('i');
            icon.classList.add('fas', 'fa-chevron-right', 'text-xs', 'mr-2', 'transition-transform');
            div.appendChild(icon);
            
            // 创建span元素
            const span = document.createElement('span');
            span.textContent = item.title;
            
            // 存储文件夹路径，用于高亮匹配
            // 通过索引页路径推断文件夹路径
            if (item.index && item.index.path) {
                const pathParts = item.index.path.split('/');
                // 如果最后一个部分是README.md，则移除它得到文件夹路径
                if (pathParts.length > 0) {
                    if (pathParts[pathParts.length - 1].toLowerCase() === 'readme.md') {
                        pathParts.pop();
                    }
                    span.dataset.folderPath = pathParts.join('/');
                    // 存储路径到div上，方便查找
                    div.dataset.folderPath = pathParts.join('/');
                }
            }
            
            div.appendChild(span);
            
            // 如果文件夹有索引页，点击文件夹标题直接跳转到索引页
            if (item.index) {
                span.classList.add('cursor-pointer');
                span.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigateToFolderIndex(item);
                });
            }
            
            // 点击图标展开/折叠子目录
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFolder(div);
            });
            
            // 点击文件夹名称展开子目录
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFolder(div);
            });
            
            li.appendChild(div);
            
            // 创建子列表（不包含索引页在顶层）
            const filteredChildren = item.index ? 
                item.children.filter(child => child.path !== item.index.path) : 
                item.children;
                
            const subUl = createNavList(filteredChildren, level + 1);
            li.appendChild(subUl);
            
        } else {
            // 文件
            const link = createNavLink(item, level);
            li.appendChild(link);
        }
        ul.appendChild(li);
    });
    return ul;
}

// 创建导航链接
function createNavLink(item, level, isIndex = false) {
    const a = document.createElement('a');
    
    // 构建URL，保留root参数
    let url = `?path=${encodeURIComponent(item.path)}`;
    if (currentRoot) {
        url += `&root=${encodeURIComponent(currentRoot)}`;
    }
    
    a.href = url;
    a.textContent = item.title;
    a.classList.add('block', 'text-gray-700', 'dark:text-gray-300', 'hover:text-primary', 'dark:hover:text-primary');
    a.classList.add(`file-level-${level}`); // 添加层级类名，用于CSS控制缩进
    
    if (isIndex) {
        a.classList.add('italic', 'text-sm'); // 索引页样式
    }
    a.dataset.path = item.path;
    a.addEventListener('click', (e) => {
        e.preventDefault();
        
        // 如果启用了自动折叠功能，先折叠所有目录
        if (config.navigation.auto_collapse) {
            collapseAllFolders();
        }
        
        // 清除所有高亮状态
        document.querySelectorAll('#sidebar-nav a').forEach(link => link.classList.remove('active'));
        document.querySelectorAll('#sidebar-nav div.folder-title').forEach(div => div.classList.remove('active-folder'));
        
        // 设置当前链接为激活状态
        a.classList.add('active');
        
        // 展开所有父级文件夹
        expandParentFolders(a);
        
        // 更新URL，保留root参数
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('path', item.path);
        if (currentRoot) {
            newUrl.searchParams.set('root', currentRoot);
        }
        // 清除URL中的hash部分，确保不会保留之前的#heading-xx
        newUrl.hash = '';
        window.history.pushState({path: item.path}, '', newUrl.toString());
        
        // 加载文档
        loadDocument(item.path);
        
        // 滚动到顶部
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    return a;
}

// 点击文件夹名称切换到文件夹描述页面的处理函数
function navigateToFolderIndex(item) {
    // 如果启用了自动折叠功能，先折叠所有目录
    if (config.navigation.auto_collapse) {
        collapseAllFolders();
    }
    
    // 清除所有高亮状态
    document.querySelectorAll('#sidebar-nav a').forEach(link => link.classList.remove('active'));
    document.querySelectorAll('#sidebar-nav div.folder-title').forEach(div => div.classList.remove('active-folder'));
    
    // 添加文件夹的高亮状态
    const folderPath = getFolderPathFromIndexPath(item.index.path);
    const folderDiv = document.querySelector(`#sidebar-nav div.folder-title[data-folder-path="${folderPath}"]`);
    if (folderDiv) {
        folderDiv.classList.add('active-folder');
        // 确保文件夹展开
        toggleFolder(folderDiv, true);
        // 展开所有父级文件夹
        expandParentFolders(folderDiv);
        
        // 自动滚动侧边栏，确保文件夹在视图中
        const sidebarContainer = document.getElementById('sidebar-container');
        if (sidebarContainer) {
            // 计算需要滚动的位置
            const folderTop = folderDiv.offsetTop - sidebarContainer.offsetHeight / 2 + folderDiv.offsetHeight / 2;
            
            // 平滑滚动到该位置
            sidebarContainer.scrollTo({
                top: Math.max(0, folderTop),
                behavior: 'smooth'
            });
        }
    }
    
    // 更新URL，添加path参数并保留root参数
    const url = new URL(window.location.href);
    url.searchParams.set('path', item.index.path);
    if (currentRoot) {
        url.searchParams.set('root', currentRoot);
    }
    // 清除URL中的hash部分，确保不会保留之前的#heading-xx
    url.hash = '';
    window.history.pushState({path: item.index.path}, '', url.toString());
    
    // 加载文档
    loadDocument(item.index.path);
    
    // 滚动到顶部
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// 展开/折叠文件夹
function toggleFolder(div, forceExpand = false) {
    const icon = div.querySelector('i');
    const subUl = div.nextElementSibling; // 对应的子列表
    
    if (subUl && subUl.tagName === 'UL') {
        const isExpanded = subUl.style.display !== 'none';
        
        // 如果强制展开，或者需要切换状态
        if ((forceExpand && !isExpanded) || (!forceExpand)) {
            subUl.style.display = forceExpand ? 'block' : (isExpanded ? 'none' : 'block');
            icon.classList.toggle('rotate-90', forceExpand || !isExpanded);
        }
    }
}

// 设置当前激活的链接或文件夹
function setActiveLink(activeElement, isFolder = false) {
    // 清除所有链接的激活状态
    document.querySelectorAll('#sidebar-nav a').forEach(a => a.classList.remove('active'));
    document.querySelectorAll('#sidebar-nav div.folder-title').forEach(div => div.classList.remove('active-folder'));
    
    if (activeElement) {
        if (isFolder) {
            activeElement.classList.add('active-folder');
        } else {
            activeElement.classList.add('active');
        }
        
        // 展开所有父级目录
        expandParentFolders(activeElement);
        
        // 自动滚动侧边栏，确保活动元素在视图中
        const sidebarContainer = document.getElementById('sidebar-container');
        if (sidebarContainer) {
            // 计算元素在侧边栏中的相对位置
            const elementRect = activeElement.getBoundingClientRect();
            const containerRect = sidebarContainer.getBoundingClientRect();
            
            // 检查元素是否在视图中
            const isInView = (
                elementRect.top >= containerRect.top &&
                elementRect.bottom <= containerRect.bottom
            );
            
            // 如果不在视图中，滚动侧边栏
            if (!isInView) {
                // 计算需要滚动的位置
                // 滚动到元素位于容器中央的位置
                const scrollTop = activeElement.offsetTop - sidebarContainer.offsetHeight / 2 + activeElement.offsetHeight / 2;
                
                // 平滑滚动到该位置
                sidebarContainer.scrollTo({
                    top: Math.max(0, scrollTop),
                    behavior: 'smooth'
                });
            }
        }
    }
}

// 展开当前元素的所有父级文件夹
function expandParentFolders(element) {
    // 首先找到element所在的li元素
    let currentLi = element.closest('li');
    
    while (currentLi) {
        // 获取父级ul
        const parentUl = currentLi.parentElement;
        
        // 如果父级ul是隐藏的，找到控制它的文件夹标题并展开
        if (parentUl && parentUl.style.display === 'none') {
            // 往上查找到父级li
            const parentLi = parentUl.closest('li');
            if (parentLi) {
                // 找到文件夹标题
                const folderDiv = parentLi.querySelector('.folder-title');
                if (folderDiv) {
                    // 展开文件夹
                    toggleFolder(folderDiv, true);
                }
            }
        }
        
        // 继续向上查找父级
        if (parentUl) {
            currentLi = parentUl.closest('li');
        } else {
            break;
        }
    }
}

// 从URL加载内容
async function loadContentFromUrl() {
    // 如果已经在加载中，则不重复加载
    if (isLoadingDocument) {
        // console.log('文档正在加载中，跳过重复加载请求');
        return;
    }
    
    // 获取URL中的path参数
    const url = new URL(window.location.href);
    let path = url.searchParams.get('path') || ''; // 使用let，因为可能需要修改
    const root = url.searchParams.get('root') || null;
    
    // 如果root参数更改或从无到有，需要重新生成侧边栏
    if (root !== currentRoot) {
        currentRoot = root;
        
        // 重新生成侧边栏
        generateSidebar(pathData);
    }
    
    // 处理默认页面或目录索引页
    if (!path) {
        // 如果没有指定页面，但有root参数，则加载root目录下的README.md
        if (currentRoot) {
            // 尝试查找root目录下的索引文件
            const rootDirNode = findNodeByPath(pathData, currentRoot);
            if (rootDirNode && rootDirNode.index) {
                path = rootDirNode.index.path;
            } else {
                // 如果没有找到索引文件，构造一个可能的路径 (不常用，但作为后备)
                for (const indexName of config.document.index_pages) {
                    const possiblePath = `${currentRoot}/${indexName}`;
                    path = possiblePath; // 暂时使用第一个可能的索引页
                    break;
                }
            }
        } else {
            // 没有root参数，加载根目录的索引页
            path = pathData?.index?.path || config.document.default_page;
        }
        
        // 更新URL以反映实际加载的路径 (如果path被修改了)
        if (path && !url.searchParams.has('path')) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('path', path);
            // 清除URL中的hash部分，确保不会保留之前的#heading-xx
            newUrl.hash = '';
            window.history.replaceState({ path: path }, '', newUrl.toString());
        }
        
    } else {
        // 支持省略/README.md，检查路径是否为目录
        const hasExtension = /\.(md|html)$/i.test(path);
        if (!hasExtension) {
            // 尝试在目录后面添加索引文件
            const indexPath = findDirectoryIndexPath(path);
            if (indexPath) {
                // 如果找到了索引页，更新路径
                path = indexPath;
                
                // 更新URL，但不触发新的导航
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('path', path);
                // 清除URL中的hash部分，确保不会保留之前的#heading-xx
                newUrl.hash = '';
                window.history.replaceState({path: path}, '', newUrl.toString());
            }
        }
    }
    
    // 如果经过上述处理后仍然没有有效的路径，则显示欢迎信息
    if (!path) {
        document.getElementById('document-content').innerHTML = `
            <h1 class="text-2xl mb-4">欢迎</h1>
            <p class="mb-4">请从左侧导航栏选择一个文档开始浏览。</p>
        `;
        document.getElementById('breadcrumb-container').innerHTML = `
            <i class="fas fa-home mr-2 text-primary"></i>
            <span>首页</span>
        `;
        document.getElementById('toc-nav').innerHTML = '<p class="text-gray-400 text-sm">暂无目录</p>';
        document.title = `${config.site.name} - ${config.site.title}`;
        return; // 结束执行
    }
    
    // 使用 decodeURIComponent 处理最终路径
    const decodedPath = decodeURIComponent(path);
    
    try {
        // 显示进度条
        showProgressBar();
        
        // 标记加载状态
        isLoadingDocument = true;
        
        // 更新进度到50%
        setTimeout(() => {
            updateProgressBar(50);
        }, 200);
        
        // 高亮侧边栏
        const isReadmeFile = decodedPath.toLowerCase().endsWith('readme.md');
        if (isReadmeFile && decodedPath.includes('/')) {
            const folderPath = decodedPath.substring(0, decodedPath.lastIndexOf('/'));
            const folderDiv = document.querySelector(`#sidebar-nav div.folder-title[data-folder-path="${folderPath}"]`);
            if (folderDiv) setActiveLink(folderDiv, true);
        } else {
            const docLink = document.querySelector(`#sidebar-nav a[data-path="${decodedPath}"]`);
            if (docLink) setActiveLink(docLink);
        }
        
        // 更新进度到70%
        setTimeout(() => {
            updateProgressBar(70);
        }, 400);
        
        // 加载文档
        await loadDocument(decodedPath);
        
        // 完成加载，隐藏进度条
        hideProgressBar();
    } catch (error) {
        console.error('加载内容出错:', error);
        hideProgressBar();
    } finally {
        // 重置加载状态
        isLoadingDocument = false;
    }
}

// 折叠所有文件夹
function collapseAllFolders() {
    const allFolderDivs = document.querySelectorAll('#sidebar-nav div.folder-title');
    
    allFolderDivs.forEach(folderDiv => {
        const icon = folderDiv.querySelector('i');
        const subUl = folderDiv.nextElementSibling;
        
        if (subUl && subUl.tagName === 'UL' && subUl.style.display !== 'none') {
            // 折叠文件夹
            subUl.style.display = 'none';
            // 更新图标
            if (icon) {
                icon.classList.remove('rotate-90');
            }
        }
    });
}

// 高亮一个路径的所有父级文件夹
function highlightParentFolders(path) {
    // 分割路径为各个部分
    const pathParts = path.split('/');
    let currentPath = '';
    
    // 逐级处理路径部分
    for (let i = 0; i < pathParts.length - 1; i++) {
        currentPath += (i > 0 ? '/' : '') + pathParts[i];
        
        // 查找并高亮对应的文件夹
        document.querySelectorAll('#sidebar-nav div.folder-title').forEach(folderDiv => {
            const span = folderDiv.querySelector('span');
            if (span && span.dataset.folderPath === currentPath) {
                // 高亮文件夹
                folderDiv.classList.add('active-folder');
                
                // 展开该文件夹
                toggleFolder(folderDiv, true);
            }
        });
    }
    
    // 尝试查找文件本身的链接
    const fileLink = document.querySelector(`#sidebar-nav a[data-path="${path}"]`);
    if (fileLink) {
        setActiveLink(fileLink);
    }
}

// 查找目录对应的索引页路径
function findDirectoryIndexPath(dirPath) {
    // 标准化路径，确保没有结尾的斜杠
    dirPath = dirPath.replace(/\/$/, '');
    
    // 检查pathData中是否存在对应的目录节点
    function findNode(node, currentPath) {
        // 如果有索引文件，直接返回
        if (node.path === dirPath && node.index) {
            return node.index.path;
        }
        
        // 递归查找子节点
        if (node.children) {
            for (const child of node.children) {
                const result = findNode(child, currentPath);
                if (result) return result;
            }
        }
        
        return null;
    }
    
    // 从路径数据中查找
    const indexPath = findNode(pathData, '');
    if (indexPath) return indexPath;
    
    // 如果在路径数据中没找到，尝试一些常见的索引文件名
    for (const indexName of config.document.index_pages) {
        const possiblePath = `${dirPath}/${indexName}`;
        // 这里我们只返回可能的路径，不检查文件是否实际存在
        // 文件存在性检查会在loadDocument中进行
        return possiblePath; // 返回第一个可能的索引页
    }
    
    return null;
}

// 加载并渲染文档
async function loadDocument(relativePath) {
    const contentDiv = document.getElementById('document-content');
    const tocNav = document.getElementById('toc-nav');
    tocNav.innerHTML = '<p class="text-gray-400 text-sm">暂无目录</p>';
    
    // 添加一个加载指示器，但不清空现有内容
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'fixed bottom-4 left-4 z-40 bg-white dark:bg-gray-800 shadow-md rounded-lg p-2 text-sm';
    loadingIndicator.innerHTML = '<p class="text-gray-600 dark:text-gray-300 flex items-center"><i class="fas fa-spinner fa-spin mr-2"></i>正在加载文档...</p>';
    document.body.appendChild(loadingIndicator);
    
    // 确保路径是相对于根目录的，而不是 data/ 目录
    const fetchPath = `${config.document.root_dir}/${relativePath}`;
    let successfullyLoaded = false; // 标记是否成功加载了内容
    
    // 首先检查缓存中是否有该文档
    const cachedContent = documentCache.get(relativePath);
    if (cachedContent) {
        // console.log(`从缓存加载文档: ${relativePath}`);
        updateProgressBar(90);
        contentDiv.innerHTML = ''; // 清空旧内容
        await renderDocument(relativePath, cachedContent, contentDiv, tocNav);
        successfullyLoaded = true;

        const isPreloaded = documentCache.isPreloaded(relativePath);
        const isCached = documentCache.isCached(relativePath);
        if (isPreloaded) addCacheStatusIndicator(contentDiv, 'preloaded');
        else if (isCached) addCacheStatusIndicator(contentDiv, 'cached');
        
    } else {
        // 不在缓存中，从网络获取
        try {
            updateProgressBar(60);
            const response = await fetch(fetchPath);
            
            updateProgressBar(70);
            if (!response.ok) {
                // ... 省略 404 和其他错误处理 (与之前类似) ...
                // 重要的: 在错误处理中也要设置 successfullyLoaded = false 或抛出错误
                throw new Error(`无法加载文档: ${response.statusText} (路径: ${fetchPath})`);
            }
            
            updateProgressBar(80);
            const content = await response.text();
            documentCache.set(relativePath, content); // 添加到持久缓存
            
            updateProgressBar(90);
            contentDiv.innerHTML = ''; // 清空旧内容
            await renderDocument(relativePath, content, contentDiv, tocNav);
            successfullyLoaded = true;
            addCacheStatusIndicator(contentDiv, 'cached');

        } catch (error) {
            console.error("加载文档失败:", error);
            contentDiv.innerHTML = `<p class="text-red-500">加载文档失败: ${error.message}</p>`;
            successfullyLoaded = false;
        }
    }

    // 移除加载指示器
    loadingIndicator.remove();
    
    // 如果成功加载，触发自动预加载
    if (successfullyLoaded) {
        setTimeout(() => {
            // **修改**: 调用新的自动预加载逻辑
            documentCache.autoPreloadDocuments(relativePath, pathData, 3);
        }, 1000);
    }

    // 滚动到页面顶部或锚点
    if (window.location.hash && window.location.hash.length > 1) {
        const targetId = window.location.hash.substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            setTimeout(() => {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }, 300); // 给内容渲染一点时间
        }
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// 添加缓存状态指示器
function addCacheStatusIndicator(contentDiv, cacheType) {
    // 移除已有的缓存状态指示器（如果有）
    const existingIndicator = document.getElementById('cache-status-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // 创建状态指示器
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'cache-status-indicator';
    
    let className, icon, text, color;
    
    switch(cacheType) {
        case 'preloaded':
            className = 'cache-status-preloaded';
            icon = 'fas fa-bolt';
            text = '预加载';
            color = 'purple';
            break;
        case 'cached':
            className = 'cache-status-cached';
            icon = 'fas fa-database';
            text = '已缓存';
            color = 'blue';
            break;
        default:
            return; // 未知类型不显示指示器
    }
    
    statusIndicator.className = `fixed bottom-4 right-4 bg-white dark:bg-gray-800 shadow-md rounded-lg p-2 text-sm z-40 flex items-center ${className} cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`;
    
    statusIndicator.innerHTML = `
        <i class="${icon} mr-2"></i>
        <span>${text}</span>
    `;
    
    // 添加到页面
    document.body.appendChild(statusIndicator);
    
    // 添加点击事件，打开缓存管理窗口
    statusIndicator.addEventListener('click', () => {
        const cacheModal = document.getElementById('cache-modal');
        if (cacheModal) {
            cacheModal.classList.remove('hidden');
            // 如果cache-manager.js导出了updateCacheList函数，则调用它
            if (typeof window.updateCacheList === 'function') {
                window.updateCacheList();
            }
        }
    });
    
    // 3秒后自动隐藏
    setTimeout(() => {
        statusIndicator.classList.add('opacity-50');
    }, 3000);
    
    // 鼠标进入时恢复透明度
    statusIndicator.addEventListener('mouseenter', () => {
        statusIndicator.classList.remove('opacity-50');
    });
    
    // 鼠标离开时恢复半透明
    statusIndicator.addEventListener('mouseleave', () => {
        statusIndicator.classList.add('opacity-50');
    });
}

// 渲染文档内容
async function renderDocument(relativePath, content, contentDiv, tocNav) {
    // 清空内容区域
    contentDiv.innerHTML = '';
    
    // 创建 markdown-body 容器
    const markdownBody = document.createElement('div');
    markdownBody.className = 'markdown-body';
    
    try {
        // 检查文件扩展名
        const isHtmlFile = relativePath.toLowerCase().endsWith('.html');
        
        if (isHtmlFile) {
            // HTML 文件使用iframe嵌入
            // console.log('使用iframe嵌入 HTML 文件:', relativePath);
            
            // 创建iframe包装容器
            const iframeContainer = document.createElement('div');
            iframeContainer.className = 'iframe-container relative mb-4 rounded-lg';
            
            // 创建iframe元素 - 使其成为let，以便于后面可以重新引用
            let iframeElement = document.createElement('iframe');
            iframeElement.className = 'w-full';
            iframeElement.style.minHeight = '500px'; // 默认最小高度
            iframeElement.title = '嵌入HTML内容';
            iframeElement.sandbox = 'allow-same-origin'; // 初始沙箱限制，禁止执行JS
            
            // 添加iframe加载事件 - 尝试自动调整高度
            iframeElement.onload = () => {
                try {
                    // 尝试获取内容高度并调整
                    setTimeout(() => {
                        try {
                            const iframeDoc = iframeElement.contentWindow.document;
                            const bodyHeight = iframeDoc.body.scrollHeight;
                            // 设置iframe高度，最小500px
                            iframeElement.style.height = Math.max(500, bodyHeight + 50) + 'px';
                            
                            // 同步暗黑模式
                            syncDarkMode(iframeDoc);
                            
                            // 生成HTML文件的目录
                            generateTocFromIframe(iframeDoc, tocNav);
                        } catch (e) {
                            console.warn('自动调整iframe高度失败:', e);
                        }
                    }, 200);
                } catch (e) {
                    console.warn('iframe加载事件处理出错:', e);
                }
            };
            
            // 创建控制按钮容器
            const controlsContainer = document.createElement('div');
            controlsContainer.className = 'controls-container';
            
            // 创建加载JS按钮
            const loadJsButton = document.createElement('button');
            loadJsButton.className = 'bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm flex items-center';
            loadJsButton.innerHTML = '<i class="fas fa-play mr-1"></i> 运行脚本';
            loadJsButton.title = '运行HTML中的JavaScript代码';
            
            // 防止重复点击
            let jsLoaded = false;
            
            loadJsButton.addEventListener('click', () => {
                if (jsLoaded) return; // 防止重复执行
                jsLoaded = true;
                
                // 改变按钮状态为加载中
                loadJsButton.className = 'bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-md text-sm flex items-center';
                loadJsButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> 加载中...';
                
                // 创建新iframe元素
                const newIframe = document.createElement('iframe');
                newIframe.className = iframeElement.className;
                newIframe.style.minHeight = iframeElement.style.minHeight;
                newIframe.title = iframeElement.title;
                newIframe.sandbox = 'allow-same-origin allow-scripts allow-forms allow-modals';
                
                // 设置加载事件
                newIframe.onload = () => {
                    try {
                        // 如果HTML内容被加载完成
                        const iframeDoc = newIframe.contentWindow.document;
                        const iframeWin = newIframe.contentWindow;
                        
                        // 同步暗黑模式
                        syncDarkMode(iframeDoc);
                        
                        // 生成HTML文件的目录
                        setTimeout(() => {
                            // 从iframe中提取标题元素并生成TOC
                            generateTocFromIframe(iframeDoc, tocNav);
                        }, 200);
                        
                        // 手动触发DOM和load事件
                        setTimeout(() => {
                            try {
                                // 手动执行脚本
                                const scriptEvent = new Event('DOMContentLoaded');
                                iframeDoc.dispatchEvent(scriptEvent);
                                
                                const loadEvent = new Event('load');
                                iframeWin.dispatchEvent(loadEvent);
                                
                                // 改变按钮状态为成功
                                loadJsButton.className = 'bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md text-sm flex items-center';
                                loadJsButton.innerHTML = '<i class="fas fa-check mr-1"></i> 已运行';
                                
                                // 自动调整iframe高度函数
                                const resizeIframe = () => {
                                    try {
                                        const bodyHeight = iframeDoc.body.scrollHeight;
                                        newIframe.style.height = Math.max(500, bodyHeight + 50) + 'px';
                                    } catch (e) {
                                        console.warn('调整iframe高度时出错:', e);
                                    }
                                };
                                
                                // 初始调整高度
                                resizeIframe();
                                // 再次尝试调整高度（防止有延迟加载的内容）
                                setTimeout(resizeIframe, 500);
                                
                                // 使用ResizeObserver监听内容变化
                                try {
                                    const resizeObserver = new ResizeObserver(debounce(() => {
                                        resizeIframe();
                                    }, 100));
                                    resizeObserver.observe(iframeDoc.body);
                                } catch (e) {
                                    console.warn('无法监控iframe内容变化:', e);
                                    // 降级方案：定时检查高度变化
                                    const intervalId = setInterval(resizeIframe, 1000);
                                    // 30秒后停止检查
                                    setTimeout(() => clearInterval(intervalId), 30000);
                                }
                                
                                // 添加iframe内容变化监听
                                try {
                                    const mutationObserver = new MutationObserver(debounce(() => {
                                        resizeIframe();
                                    }, 100));
                                    
                                    mutationObserver.observe(iframeDoc.body, {
                                        childList: true,
                                        subtree: true,
                                        attributes: true
                                    });
                                } catch (e) {
                                    console.warn('无法监控iframe DOM变化:', e);
                                }
                            } catch (e) {
                                console.error('执行iframe JS时出错:', e);
                                loadJsButton.className = 'bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm flex items-center';
                                loadJsButton.innerHTML = '<i class="fas fa-exclamation-triangle mr-1"></i> 执行失败';
                            }
                        }, 100);
                    } catch (e) {
                        console.error('iframe加载事件处理出错:', e);
                        loadJsButton.className = 'bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm flex items-center';
                        loadJsButton.innerHTML = '<i class="fas fa-exclamation-triangle mr-1"></i> 加载失败';
                    }
                };
                
                // 设置iframe内容
                newIframe.srcdoc = content;
                
                // 替换旧iframe
                iframeContainer.replaceChild(newIframe, iframeElement);
                iframeElement = newIframe; // 更新引用
            });
            
            // 创建调整大小按钮
            const resizeButton = document.createElement('button');
            resizeButton.className = 'bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm flex items-center';
            resizeButton.innerHTML = '<i class="fas fa-expand-alt mr-1"></i> 全屏';
            resizeButton.title = '全屏显示';
            
            // 切换全屏显示
            let isFullscreen = false;
            resizeButton.addEventListener('click', () => {
                isFullscreen = !isFullscreen;
                
                if (isFullscreen) {
                    // 仅让iframe全屏
                    iframeElement.classList.add('iframe-fullscreen');
                    resizeButton.innerHTML = '<i class="fas fa-compress-alt mr-1"></i> 退出全屏';
                    
                    // 添加关闭按钮，以防iframe内无法点击控制按钮
                    const closeFullscreenBtn = document.createElement('button');
                    closeFullscreenBtn.id = 'close-fullscreen-btn';
                    closeFullscreenBtn.className = 'fixed top-4 right-4 z-[9999] bg-white dark:bg-gray-800 text-gray-800 dark:text-white p-2 rounded-full shadow-lg';
                    closeFullscreenBtn.innerHTML = '<i class="fas fa-times"></i>';
                    closeFullscreenBtn.addEventListener('click', () => {
                        iframeElement.classList.remove('iframe-fullscreen');
                        isFullscreen = false;
                        resizeButton.innerHTML = '<i class="fas fa-expand-alt mr-1"></i> 全屏';
                        document.getElementById('close-fullscreen-btn')?.remove();
                    });
                    document.body.appendChild(closeFullscreenBtn);
                } else {
                    // 退出全屏
                    iframeElement.classList.remove('iframe-fullscreen');
                    resizeButton.innerHTML = '<i class="fas fa-expand-alt mr-1"></i> 全屏';
                    document.getElementById('close-fullscreen-btn')?.remove();
                }
            });
            
            // 组装控制按钮
            controlsContainer.appendChild(loadJsButton);
            
            controlsContainer.appendChild(resizeButton);
            
            // 设置iframe初始内容（不运行JS）
            iframeElement.srcdoc = content;
            
            // 组装整个容器
            iframeContainer.appendChild(iframeElement);
            iframeContainer.appendChild(controlsContainer);
            
            // 添加提示消息
            const hintMessage = document.createElement('div');
            hintMessage.className = 'text-xs text-gray-500 dark:text-gray-400 mt-1 ml-2';
            hintMessage.textContent = '此HTML内容在沙箱中运行，点击"运行脚本"按钮以启用JavaScript';
            
            markdownBody.appendChild(iframeContainer);
            markdownBody.appendChild(hintMessage);
            
            // 添加到内容区域
            contentDiv.appendChild(markdownBody);
        } else {
            // Markdown 文件处理
            // console.log('渲染 Markdown 文件:', relativePath);
            
            // 预处理Markdown内容，处理块级数学公式
            content = preProcessMathContent(content);
            
            // 使用 marked 解析 Markdown
            const markedContent = marked.parse(content, {
                gfm: true,
                breaks: true,
                headerIds: true,
                mangle: false,
                highlight(code, lang) {
                    return hljs.highlight(lang || 'plaintext', code).value;
                }
            });
            
            // 设置解析后的内容
            markdownBody.innerHTML = markedContent;
            
            // 添加到内容区域
            contentDiv.appendChild(markdownBody);
        }
        
        // 处理代码块 - 必须在处理数学公式之前执行
        const codeBlocks = markdownBody.querySelectorAll('pre code');
        codeBlocks.forEach(block => {
            // **首先检查是否是 Mermaid 代码块**
            if (block.classList.contains('language-mermaid')) {
                return; // 由 mermaid-handler.js 处理，此处跳过
            }

            // 获取 pre 元素
            const preElement = block.parentElement;
            
            // 应用 highlight.js
            if (config.extensions.highlight) {
                hljs.highlightElement(block);
            }
            
            // 创建代码块包装器
            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-wrapper';
            
            // 替换 pre 元素为包装器
            preElement.parentNode.insertBefore(wrapper, preElement);
            wrapper.appendChild(preElement);
            
            // 处理行号
            if (config.document.code_block?.line_numbers) {
                // 获取代码内容
                const codeLines = block.textContent.split('\n');
                // 如果最后一行是空行，移除它
                if (codeLines[codeLines.length - 1] === '') {
                    codeLines.pop();
                }
                
                // 生成行号
                const startLine = config.document.code_block.start_line || 1;
                const lineNumbers = Array.from(
                    { length: codeLines.length }, 
                    (_, i) => startLine + i
                ).join('\n');
                
                // 添加行号
                preElement.classList.add('has-line-numbers');
                preElement.setAttribute('data-line-numbers', lineNumbers);
            }
            
            // 如果启用了代码复制按钮，添加复制功能
            if (config.document.code_copy_button) {
                // 创建复制按钮容器
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'code-copy-button-container';
                
                // 创建复制按钮
                const copyButton = document.createElement('button');
                copyButton.className = 'code-copy-button';
                copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                copyButton.title = '复制代码';
                
                // 添加复制功能
                copyButton.addEventListener('click', async (e) => {
                    // 阻止事件冒泡，避免触发其他事件
                    e.stopPropagation();
                    
                    try {
                        await navigator.clipboard.writeText(block.textContent);
                        copyButton.innerHTML = '<i class="fas fa-check"></i>';
                        setTimeout(() => {
                            copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                        }, 2000);
                    } catch (err) {
                        console.error('复制失败:', err);
                        copyButton.innerHTML = '<i class="fas fa-times"></i>';
                        setTimeout(() => {
                            copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                        }, 2000);
                    }
                });
                
                // 将按钮添加到容器
                buttonContainer.appendChild(copyButton);
                
                // 将按钮容器添加到包装器
                wrapper.appendChild(buttonContainer);
            }
        });
        
        // 手动处理块级数学公式 (必须在代码块处理后执行)
        if (config.extensions.math && !isHtmlFile) { // 只对Markdown文件处理公式
            processBlockMath(markdownBody);
        }
        
        // Mermaid图表处理完成后，才处理其他元素
        const mermaidDivs = markdownBody.querySelectorAll('.mermaid');
        if (mermaidDivs.length > 0 && typeof mermaid !== 'undefined' && config.extensions.mermaid) {
            mermaid.init(undefined, mermaidDivs);
        }
        
        // 处理图片链接
        fixExternalImageLinks(markdownBody);
        
        // 处理内部链接
        fixInternalLinks(markdownBody);
        
        // 处理外部链接
        fixExternalLinks(markdownBody);
        
        // 生成目录
        generateToc(markdownBody);
        
        // 更新页面标题
        updatePageTitle(relativePath);
        
        // 生成面包屑导航
        generateBreadcrumb(relativePath);
        
        // 添加上一篇/下一篇导航
        generatePrevNextNavigation(relativePath);
        
        // 显示Git和GitHub相关信息
        updateGitInfo(relativePath);
        
        // 触发内容已加载事件，用于KaTeX自动渲染和其他需要在内容加载后执行的操作
        document.dispatchEvent(new CustomEvent('mdContentLoaded', {
            detail: { markdownBody, contentPath: relativePath }
        }));
        
        // 添加图片点击放大功能
        const images = contentDiv.querySelectorAll('img:not(a > img)'); // 选择不在链接内的图片
        
        // 确保模态框只创建一次
        let imageModal = document.getElementById('custom-image-modal');
        if (!imageModal) {
            // 创建自定义图片放大模态框
            imageModal = document.createElement('div');
            imageModal.id = 'custom-image-modal';
            imageModal.className = 'custom-image-modal';
            
            // 添加关闭按钮
            const closeBtn = document.createElement('div');
            closeBtn.className = 'close-btn';
            closeBtn.innerHTML = '<i class="fas fa-times"></i>';
            closeBtn.onclick = () => {
                imageModal.classList.remove('active');
                setTimeout(() => {
                    modalImg.src = ''; // 清空图像源，减少内存占用
                }, 300); // 等待transition完成
            };
            
            // 添加图片元素
            const modalImg = document.createElement('img');
            modalImg.alt = '放大图片';
            
            // 点击图片也可以关闭模态框
            modalImg.onclick = () => {
                imageModal.classList.remove('active');
                setTimeout(() => {
                    modalImg.src = ''; // 清空图像源
                }, 300);
            };
            
            // 按ESC键关闭模态框
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && imageModal.classList.contains('active')) {
                    imageModal.classList.remove('active');
                    setTimeout(() => {
                        modalImg.src = ''; // 清空图像源
                    }, 300);
                }
            });
            
            // 组装模态框
            imageModal.appendChild(modalImg);
            imageModal.appendChild(closeBtn);
            document.body.appendChild(imageModal);
        }
        
        // 为每个图片添加点击事件
        images.forEach(img => {
            img.style.cursor = 'zoom-in'; // 添加鼠标样式
            img.addEventListener('click', () => {
                const modalImg = imageModal.querySelector('img');
                modalImg.src = img.src;
                modalImg.alt = img.alt || '放大图片';
                
                // 显示模态框（延迟一点点以确保图片已加载）
                setTimeout(() => {
                    imageModal.classList.add('active');
                }, 50);
            });
        });
        
        // 修正外部链接
        fixExternalLinks(contentDiv);
        // 修正外部图片链接（如果需要）
        fixExternalImageLinks(contentDiv);
        
        // 修正内部链接
        fixInternalLinks(contentDiv);

        // 生成并滚动目录
        const tocItems = generateToc(contentDiv);
    } catch (error) {
        console.error('渲染文档时出错:', error);
        contentDiv.innerHTML = '<div class="error-message">文档渲染失败</div>';
    }
}

// 预处理Markdown内容中的数学公式
function preProcessMathContent(content) {
    // 分割代码块和非代码块
    const segments = [];
    let isInCodeBlock = false;
    let currentSegment = '';
    let codeBlockLang = '';
    
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 检测代码块开始或结束
        if (line.trim().startsWith('```')) {
            if (!isInCodeBlock) {
                // 开始新代码块
                isInCodeBlock = true;
                // 获取代码块语言
                codeBlockLang = line.trim().substring(3).trim();
                
                // 保存之前的非代码块内容
                if (currentSegment) {
                    segments.push({
                        type: 'text',
                        content: currentSegment
                    });
                }
                
                // 开始新的代码块内容
                currentSegment = line + '\n';
            } else {
                // 结束当前代码块
                isInCodeBlock = false;
                currentSegment += line;
                
                // 保存代码块内容
                segments.push({
                    type: 'code',
                    content: currentSegment,
                    lang: codeBlockLang
                });
                
                // 重置内容收集器
                currentSegment = '';
            }
        } else {
            // 普通行，添加到当前段落
            currentSegment += line + '\n';
        }
    }
    
    // 添加最后一段内容
    if (currentSegment) {
        segments.push({
            type: isInCodeBlock ? 'code' : 'text',
            content: currentSegment,
            lang: isInCodeBlock ? codeBlockLang : ''
        });
    }
    
    // 只处理非代码块中的公式
    for (let i = 0; i < segments.length; i++) {
        if (segments[i].type === 'text') {
            // 处理块级公式
            segments[i].content = segments[i].content.replace(/\$\$([\s\S]*?)\$\$/g, function(match, formula) {
                return `<div class="math-block">$$${formula}$$</div>`;
            });
        }
    }
    
    // 重新组合内容
    return segments.map(segment => segment.content).join('');
}

// 处理文档中的块级数学公式
function processBlockMath(container) {
    // 检查是否启用了数学公式支持
    if (!config.extensions.math) return;
    
    // 确保KaTeX已加载
    if (typeof katex === 'undefined') {
        console.warn('KaTeX未加载，无法渲染数学公式');
        return;
    }
    
    // 查找所有数学块容器 (排除在代码块内的)
    const mathBlocks = container.querySelectorAll('div.math-block');
    
    mathBlocks.forEach(block => {
        // 检查是否在代码块内
        if (block.closest('pre') || block.closest('code')) {
            // 在代码块内，不处理
            return;
        }
        
        // 提取公式（去掉$$符号）
        const formula = block.textContent.replace(/^\$\$([\s\S]*)\$\$$/, '$1');
        
        // 创建一个新的div用于KaTeX渲染
        const displayMath = document.createElement('div');
        displayMath.className = 'katex-display';
        
        try {
            // 直接使用KaTeX渲染
            katex.render(formula, displayMath, {
                throwOnError: false,
                displayMode: true
            });
            
            // 替换原始内容
            block.innerHTML = '';
            block.appendChild(displayMath);
        } catch (err) {
            console.error('渲染块级公式失败:', err);
            block.innerHTML = `<div class="katex-error">公式渲染错误: ${formula}</div>`;
        }
    });
    
    // 处理行内公式
    const inlineMathElements = container.querySelectorAll('.math');
    inlineMathElements.forEach(element => {
        // 检查是否在代码块内
        if (element.closest('pre') || element.closest('code')) {
            // 在代码块内，不处理
            return;
        }
        
        // 处理包含$...$格式的公式
        const formula = element.textContent;
        try {
            katex.render(formula, element, {
                throwOnError: false,
                displayMode: false
            });
        } catch (err) {
            console.error('渲染行内公式失败:', err);
        }
    });
}

// 更新页面标题
function updatePageTitle(path) {
    const activeLink = document.querySelector(`#sidebar-nav a[data-path="${path}"]`);
    let title = activeLink ? activeLink.textContent : '文档';
    document.title = `${title} - ${config.site.name}`;
}

// 生成面包屑导航
function generateBreadcrumb(path) {
    const container = document.getElementById('breadcrumb-container');
    container.innerHTML = '';
    if (!config.navigation.breadcrumb) return;
    
    // 分解路径，提取目录结构
    const parts = path.split('/');
    const breadcrumbParts = [];
    
    // 添加首页
    let homeUrl = '?';
    if (currentRoot) {
        homeUrl += `root=${encodeURIComponent(currentRoot)}`;
    }
    
    breadcrumbParts.push({
        text: config.navigation.home_text || '首页',
        path: '',
        url: homeUrl,
        isLast: false
    });
    
    // 构建去重后的面包屑路径
    let currentPath = '';
    let lastTitle = '';
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // 如果是README.md或类似索引文件，跳过
        if (i === parts.length - 1 && isIndexFile(part)) {
            continue;
        }
        
        currentPath += (i > 0 ? '/' : '') + part;
        
        // 获取当前路径的标题
        const title = getTitleFromPath(currentPath) || part;
        
        // 避免添加重复的标题（如README.md与其父目录名称相同的情况）
        if (title !== lastTitle) {
            breadcrumbParts.push({
                text: title,
                path: currentPath,
                url: filePathToUrl(currentPath),
                isLast: i === parts.length - 1 || (i === parts.length - 2 && isIndexFile(parts[parts.length - 1]))
            });
            lastTitle = title;
        }
    }
    
    // 创建面包屑HTML元素
    breadcrumbParts.forEach((item, index) => {
        // 添加分隔符（除了第一项）
        if (index > 0) {
            const separator = document.createElement('span');
            separator.textContent = ' / ';
            separator.classList.add('mx-1');
            container.appendChild(separator);
        }
        
        if (item.isLast) {
            // 当前页面（最后一项）
            const span = document.createElement('span');
            span.textContent = item.text;
            span.classList.add('text-gray-800', 'dark:text-white');
            container.appendChild(span);
        } else {
            // 链接项
            const link = document.createElement('a');
            link.href = item.url;
            link.textContent = item.text;
            link.classList.add('hover:text-primary');
            container.appendChild(link);
        }
    });
}

// 检查文件名是否为索引文件
function isIndexFile(filename) {
    return config.document.index_pages.some(indexName => 
        filename.toLowerCase() === indexName.toLowerCase());
}

// 从路径获取标题（基于侧边栏数据）
function getTitleFromPath(path) {
    const link = document.querySelector(`#sidebar-nav a[data-path="${path}"]`);
    return link ? link.textContent : null;
}

// 查找目录的索引页路径
function findIndexPath(dirPath) {
    function find(node, targetPath) {
        if (node.path === targetPath && node.index) {
            return node.index.path;  // 返回索引页的路径，不带'#'前缀
        }
        if (node.children) {
            for (const child of node.children) {
                const found = find(child, targetPath);
                if (found) return found;
            }
        }
        return null;
    }
    return find(pathData, dirPath);
}

// 生成右侧目录 (TOC)
function generateToc(contentElement) {
    const tocNav = document.getElementById('toc-nav');
    tocNav.innerHTML = '';
    
    // **修改**: 直接在 contentElement 中查找标题
    const headings = contentElement.querySelectorAll(`h1, h2, h3, h4, h5, h6`);
    
    const tocDepth = config.document.toc_depth || 3;
    // 是否显示标题编号
    const showNumbering = config.document.toc_numbering || false;
    // 是否忽略h1标题计数
    const ignoreH1 = config.document.toc_ignore_h1 || false;
    
    // 用于生成标题编号的计数器
    const counters = [0, 0, 0, 0, 0, 0];
    let lastLevel = 0;
    
    const headingsArray = Array.from(headings); // 直接转换
    
    if (headingsArray.length === 0) {
        tocNav.innerHTML = '<p class="text-gray-400 text-sm">暂无目录</p>';
        return; // 如果没有标题，直接返回
    }
    
    headingsArray.forEach((heading, index) => { // 使用转换后的数组
        const level = parseInt(heading.tagName.substring(1));
        if (level > tocDepth) return;

        // 如果标题没有ID，添加一个
        if (!heading.id) {
            heading.id = `heading-${index}`;
        }
        const id = heading.id;
        
        // 处理标题编号
        let prefix = '';
        if (showNumbering) {
            // 如果设置了忽略h1并且当前是h1，不生成编号
            if (ignoreH1 && level === 1) {
                prefix = '';
            } else {
                // 更新计数器，对h1做特殊处理
                if (level > lastLevel) {
                    // 如果新标题级别比上一个大，将所有更深层级的计数器重置为0
                    for (let i = lastLevel; i < level; i++) {
                        // 如果忽略h1，并且是处理h1计数器，则跳过
                        if (!(ignoreH1 && i === 0)) {
                            counters[i]++;
                        }
                    }
                    for (let i = level; i < counters.length; i++) {
                        counters[i] = 0;
                    }
                } else if (level === lastLevel) {
                    // 如果新标题与上一个同级，递增计数器
                    // 如果忽略h1，并且是处理h1计数器，则跳过
                    if (!(ignoreH1 && level === 1)) {
                        counters[level - 1]++;
                    }
                } else {
                    // 如果新标题比上一个小（更高级别），递增当前级别并重置更低级别
                    // 如果忽略h1，并且是处理h1计数器，则跳过
                    if (!(ignoreH1 && level === 1)) {
                        counters[level - 1]++;
                    }
                    for (let i = level; i < counters.length; i++) {
                        counters[i] = 0;
                    }
                }
                
                // 生成标题编号，注意对h1的特殊处理
                prefix = '';
                // 如果忽略h1，则从h2开始计数
                const startIdx = ignoreH1 ? 1 : 0;
                for (let i = startIdx; i < level; i++) {
                    if (counters[i] > 0) {
                        prefix += counters[i] + '.';
                    }
                }
                prefix = prefix ? `${prefix} ` : '';
            }
        }
        
        lastLevel = level;

        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `#${id}`; // 直接跳转到ID
        a.innerHTML = prefix + heading.textContent;  // 使用innerHTML以支持编号+标题文本
        a.classList.add('block', 'text-sm', 'py-1', 'hover:text-primary', 'dark:hover:text-primary');
        a.style.marginLeft = `${(level - 1) * 0.75}rem`; // 缩进
        a.dataset.headingId = id;
        
        // 点击目录条目时滚动到对应标题
        a.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // 阻止冒泡，防止触发document的全局点击事件处理
            const targetHeading = document.getElementById(id);
            if (targetHeading) {
                // 计算目标位置，使标题显示在屏幕上方25%的位置
                const targetPosition = targetHeading.getBoundingClientRect().top + window.pageYOffset;
                const offset = window.innerHeight * 0.25; // 屏幕高度的25%
                window.scrollTo({
                    top: targetPosition - offset,
                    behavior: 'smooth'
                });
                
                // 更新URL hash但不触发页面跳转
                history.pushState(null, null, `#${id}`);
                
                // 高亮当前目录项
                document.querySelectorAll('#toc-nav a').forEach(link => link.classList.remove('active'));
                a.classList.add('active');
                
                // 确保当前目录项在视图中
                scrollTocToActiveItem(a);
            }
        });
        
        li.appendChild(a);
        tocNav.appendChild(li);
    });
    
    // 移除旧的滚动监听器（如果有）
    window.removeEventListener('scroll', handleTocScrollHighlight);
    // 添加滚动监听，高亮当前章节
    window.addEventListener('scroll', handleTocScrollHighlight);
}

// 处理TOC滚动高亮的函数
const handleTocScrollHighlight = debounce(() => {
    const tocNav = document.getElementById('toc-nav');
    if (!tocNav || tocNav.children.length <= 1) return; // 没有足够的目录项

    const scrollPosition = window.scrollY;
    let currentHeadingId = null;
    let activeLink = null;

    // 特殊处理：当滚动到页面顶部时
    if (scrollPosition <= 50) { // 使用一个小的阈值，而不是严格的0
        // 找到第一个目录项
        const firstLink = tocNav.querySelector('a');
        if (firstLink) {
            currentHeadingId = firstLink.dataset.headingId;
            activeLink = firstLink;
        }
    } else {
        // 获取所有内容标题元素
        const contentElement = document.getElementById('document-content');
        const headingElements = contentElement ? Array.from(contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6')) : [];

        if (headingElements.length === 0) return;

        // 找到当前可见的标题
        // 增加偏移量，使标题在屏幕靠上的位置时就被选中
        const offset = window.innerHeight * 0.3;

        for (let i = 0; i < headingElements.length; i++) {
            const heading = headingElements[i];
            const headingTop = heading.offsetTop;

            // 如果标题顶部在当前滚动位置+偏移量之上
            if (headingTop <= scrollPosition + offset) {
                currentHeadingId = heading.id;
            } else {
                // 一旦找到第一个低于滚动位置的标题，就停止
                break;
            }
        }
        
        // 如果循环结束仍然没有找到currentHeadingId（可能滚动太快或页面结构问题），
        // 尝试选择第一个标题
        if (!currentHeadingId && headingElements.length > 0) {
            currentHeadingId = headingElements[0].id;
        }
    }

    // 更新目录高亮
    document.querySelectorAll('#toc-nav a').forEach(link => {
        const isActive = link.dataset.headingId === currentHeadingId;
        link.classList.toggle('active', isActive);
        
        // 如果是活动链接，确保它在视图中
        if (isActive) {
            scrollTocToActiveItem(link);
        }
    });
}, 100);

// 滚动TOC，确保活动项在视图中
function scrollTocToActiveItem(activeItem) {
    const tocContainer = document.getElementById('toc-container');
    if (!tocContainer || !activeItem) return;
    
    // 计算元素在TOC中的相对位置
    const itemRect = activeItem.getBoundingClientRect();
    const containerRect = tocContainer.getBoundingClientRect();
    
    // 检查元素是否 *完全* 在视图中
    const isFullyInView = (
        itemRect.top >= containerRect.top &&
        itemRect.bottom <= containerRect.bottom
    );
    
    // 如果不在视图中，滚动TOC
    if (!isFullyInView) {
        // 计算需要滚动的位置
        // 目标：将活动项滚动到TOC容器的中间位置
        const scrollTop = activeItem.offsetTop - tocContainer.offsetHeight / 2 + activeItem.offsetHeight / 2;
        
        // 平滑滚动到该位置
        tocContainer.scrollTo({
            top: Math.max(0, scrollTop),
            behavior: 'smooth'
        });
    }
}

// 检查当前是否为暗黑模式
function isDarkMode() {
    return document.documentElement.classList.contains('dark');
}

// 将文件路径转换为URL基础路径
function filePathToUrl(path) {
    let url = `?path=${encodeURIComponent(path)}`;
    if (currentRoot) {
        url += `&root=${encodeURIComponent(currentRoot)}`;
    }
    return url;
}

// 修复外部链接，在外部链接上添加target="_blank"
function fixExternalLinks(container) {
    const links = container.querySelectorAll('a');
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('www.'))) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener');
        }
    });
}

// 修复外部图片链接
function fixExternalImageLinks(container) {
    const images = container.querySelectorAll('img');
    images.forEach(img => {
        const src = img.getAttribute('src');
        // 检查图片地址是否出现了undefined前缀
        if (src && src.startsWith('undefined')) {
            // 修复图片地址
            const fixedSrc = src.replace(/^undefined/, '');
            img.setAttribute('src', fixedSrc);
        }
        
        // 为图片添加错误处理
        img.addEventListener('error', function() {
            // 图片加载失败时显示占位图
            this.src = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23cccccc\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Crect x=\'3\' y=\'3\' width=\'18\' height=\'18\' rx=\'2\' ry=\'2\'/%3E%3Ccircle cx=\'8.5\' cy=\'8.5\' r=\'1.5\'/%3E%3Cpolyline points=\'21 15 16 10 5 21\'/%3E%3C/svg%3E';
            this.classList.add('img-error');
            this.setAttribute('alt', '图片加载失败');
            this.style.padding = '2rem';
            this.style.background = '#f5f5f5';
            if (isDarkMode()) {
                this.style.background = '#333';
            }
        });
    });
}

// 防抖函数，避免滚动事件过于频繁
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

// 生成上一篇/下一篇导航
function generatePrevNextNavigation(currentPath) {
    const contentDiv = document.getElementById('document-content');
    
    // 移除现有的导航（如果有）
    const existingNav = document.getElementById('prev-next-navigation');
    if (existingNav) {
        existingNav.remove();
    }
    
    // 获取所有文档链接
    const allLinks = getAllDocumentLinks();
    
    // 找到当前文档的索引
    const currentIndex = allLinks.findIndex(link => link.path === currentPath);
    if (currentIndex === -1) return; // 未找到当前文档
    
    // 创建导航容器
    const navContainer = document.createElement('div');
    navContainer.id = 'prev-next-navigation';
    navContainer.className = 'mt-16 pt-8 border-t border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:justify-between';
    
    // 上一篇
    if (currentIndex > 0) {
        const prevLink = allLinks[currentIndex - 1];
        const prevDiv = document.createElement('div');
        prevDiv.className = 'mb-4 md:mb-0';
        
        // 构建URL，保留root参数
        let prevUrl = `?path=${encodeURIComponent(prevLink.path)}`;
        if (currentRoot) {
            prevUrl += `&root=${encodeURIComponent(currentRoot)}`;
        }
        
        prevDiv.innerHTML = `
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">上一篇</p>
            <a href="${prevUrl}" class="text-primary hover:underline flex items-center">
                <i class="fas fa-arrow-left mr-2"></i>
                ${prevLink.title}
            </a>
        `;
        navContainer.appendChild(prevDiv);
    } else {
        // 占位，保持布局
        const emptyDiv = document.createElement('div');
        navContainer.appendChild(emptyDiv);
    }
    
    // 下一篇
    if (currentIndex < allLinks.length - 1) {
        const nextLink = allLinks[currentIndex + 1];
        const nextDiv = document.createElement('div');
        nextDiv.className = 'text-right';
        
        // 构建URL，保留root参数
        let nextUrl = `?path=${encodeURIComponent(nextLink.path)}`;
        if (currentRoot) {
            nextUrl += `&root=${encodeURIComponent(currentRoot)}`;
        }
        
        nextDiv.innerHTML = `
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">下一篇</p>
            <a href="${nextUrl}" class="text-primary hover:underline flex items-center justify-end">
                ${nextLink.title}
                <i class="fas fa-arrow-right ml-2"></i>
            </a>
        `;
        navContainer.appendChild(nextDiv);
    } else {
        // 占位，保持布局
        const emptyDiv = document.createElement('div');
        navContainer.appendChild(emptyDiv);
    }
    
    // 添加到文档底部
    contentDiv.appendChild(navContainer);
}

// 获取所有文档链接，按照path.json中从上到下的顺序
function getAllDocumentLinks() {
    const links = [];
    const addedPaths = new Set(); // 防止重复添加
    
    // 辅助函数：添加文档到列表（如果尚未添加）
    function addDoc(path, title) {
        if (!addedPaths.has(path)) {
            links.push({ path, title });
            addedPaths.add(path);
            return true;
        }
        return false;
    }
    
    // 按照定义顺序遍历整个文档树
    function traverseInOrder(node) {
        // 1. 首先添加当前节点的索引页（如果是目录且有索引页）
        if (node.index) {
            addDoc(node.index.path, node.index.title);
        }
        
        // 2. 然后添加所有子节点
        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                // 如果是文件（没有children），直接添加
                if (!child.children || child.children.length === 0) {
                    addDoc(child.path, child.title);
                } else {
                    // 如果是目录，先添加其索引页
                    if (child.index) {
                        addDoc(child.index.path, child.index.title);
                    }
                    
                    // 然后遍历其子节点
                    traverseInOrder(child);
                }
            }
        }
    }
    
    // 开始遍历
    traverseInOrder(pathData);
    
    return links;
}

// 修复内部链接，维持root参数
function fixInternalLinks(container) {
    const links = container.querySelectorAll('a');
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('#')) {
            // 内部链接，检查是否是相对路径
            if (!href.startsWith('?')) {
                // 获取完整路径并编码
                let newHref = `?path=${encodeURIComponent(href)}`;
                if (currentRoot) {
                    newHref += `&root=${encodeURIComponent(currentRoot)}`;
                }
                link.setAttribute('href', newHref);
            } else if (href.includes('path=') && currentRoot && !href.includes('root=')) {
                // 已有path参数但没有root参数
                link.setAttribute('href', `${href}&root=${encodeURIComponent(currentRoot)}`);
            }
        }
    });
}

// 查找文档信息对象（文件节点或索引对象）
function findDocInfoByPath(node, targetPath) {
    // 检查当前节点本身是否是目标文件（非索引）
    if (node.path === targetPath && (!node.children || node.children.length === 0)) { 
        return node;
    }

    // 检查当前节点的索引文件是否是目标
    if (node.index && node.index.path === targetPath) {
        return node.index; // 返回index对象，它包含git信息
    }

    // 递归检查子节点
    if (node.children) {
        for (const child of node.children) {
            const found = findDocInfoByPath(child, targetPath);
            if (found) {
                return found;
            }
        }
    }

    return null; // 未找到
}

// 更新Git和GitHub相关信息
function updateGitInfo(relativePath) {
    // 查找当前文档的Git信息 - 使用新的查找函数
    const docInfo = findDocInfoByPath(pathData, relativePath);
    
    // 检查docInfo是否存在，以及是否有git属性
    if (!docInfo || !docInfo.git) {
        // 隐藏Git信息区域
        hideGitInfoElements();
        return;
    }
    
    // 是否启用Git和GitHub功能
    const gitEnabled = config.extensions?.git?.enable !== false;
    const githubEnabled = config.extensions?.github?.enable !== false;
    
    // 如果Git和GitHub都禁用，则不显示
    if (!gitEnabled && !githubEnabled) {
        hideGitInfoElements();
        return;
    }
    
    // 处理最后修改时间信息
    // 只有当git启用且显示最后修改时间时才处理
    if (gitEnabled && config.extensions?.git?.show_last_modified !== false && docInfo.git.last_modified) {
        const lastModified = docInfo.git.last_modified;
        const modifiedTime = document.getElementById('modified-time');
        const modifiedAuthor = document.getElementById('modified-author');
        const lastModifiedContainer = document.getElementById('last-modified');
        
        if (modifiedTime && modifiedAuthor && lastModifiedContainer) {
            const date = new Date(lastModified.date + ' ' + lastModified.time);
            const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
            const formattedDate = date.toLocaleString('zh-CN', options);
            
            modifiedTime.textContent = formattedDate;
            modifiedAuthor.textContent = lastModified.author;
            
            // 显示最后修改时间区域
            lastModifiedContainer.style.display = 'flex';
        } else {
            // 如果元素不存在，确保容器隐藏
            const lastModifiedContainer = document.getElementById('last-modified');
            if (lastModifiedContainer) lastModifiedContainer.style.display = 'none';
        }
    } else {
        // 如果不显示，确保容器隐藏
        const lastModifiedContainer = document.getElementById('last-modified');
        if (lastModifiedContainer) lastModifiedContainer.style.display = 'none';
    }
    
    // 处理贡献者信息
    const contributorsList = document.getElementById('contributors-list');
    const contributorsContainer = document.getElementById('contributors-container');
    
    // 检查贡献者列表和容器是否存在，以及是否有贡献者数据
    if (contributorsList && contributorsContainer && docInfo.git.contributors && docInfo.git.contributors.length > 0) {
        // 判断是否显示头像 - 受github.enable影响
        const showAvatar = githubEnabled && config.extensions?.github?.show_avatar === true;
        
        // 判断是否显示贡献者列表 - 当显示头像时忽略git.enable和git.show_contributors设置
        const showContributors = showAvatar || (gitEnabled && config.extensions?.git?.show_contributors !== false);
        
        if (showContributors) {
            // 清空现有贡献者列表
            contributorsList.innerHTML = '';
            
            // 添加所有贡献者
            docInfo.git.contributors.forEach(contributor => {
                if (showAvatar) {
                    // 如果有GitHub头像
                    if (contributor.github_avatar) {
                        // 创建头像元素
                        const avatar = document.createElement('img');
                        avatar.src = contributor.github_avatar;
                        avatar.alt = contributor.name;
                        avatar.title = `${contributor.name} (${contributor.commits} commits)`;
                        avatar.className = 'w-6 h-6 rounded-full';
                        
                        // 图片加载失败时的处理
                        avatar.onerror = function() {
                            // 移除失败的图片
                            this.parentNode?.removeChild(this);
                            
                            // 创建替代的昵称标签
                            const nameSpan = document.createElement('span');
                            nameSpan.textContent = contributor.name;
                            nameSpan.title = `${contributor.commits} commits`;
                            nameSpan.className = 'px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs';
                            
                            // 如果是链接内的图片，将标签加入链接
                            if (this.parentNode && this.parentNode.tagName === 'A') {
                                this.parentNode.appendChild(nameSpan);
                            } else {
                                contributorsList.appendChild(nameSpan);
                            }
                        };
                        
                        // 设置头像链接
                        if (contributor.github_username) {
                            const avatarLink = document.createElement('a');
                            avatarLink.href = `https://github.com/${contributor.github_username}`;
                            avatarLink.target = '_blank';
                            avatarLink.title = `${contributor.name} (${contributor.commits} commits)`;
                            avatarLink.appendChild(avatar);
                            contributorsList.appendChild(avatarLink);
                        } else {
                            contributorsList.appendChild(avatar);
                        }
                    } else {
                        // 没有GitHub头像，直接显示昵称
                        const nameSpan = document.createElement('span');
                        nameSpan.textContent = contributor.name;
                        nameSpan.title = `${contributor.commits} commits`;
                        nameSpan.className = 'px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs';
                        
                        // 如果有GitHub用户名，添加链接
                        if (contributor.github_username) {
                            const nameLink = document.createElement('a');
                            nameLink.href = `https://github.com/${contributor.github_username}`;
                            nameLink.target = '_blank';
                            nameLink.appendChild(nameSpan);
                            contributorsList.appendChild(nameLink);
                        } else {
                            contributorsList.appendChild(nameSpan);
                        }
                    }
                } else {
                    // 显示昵称模式，保持不变
                    // 创建名称标签
                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = contributor.name;
                    nameSpan.title = `${contributor.commits} commits`;
                    nameSpan.className = 'px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-xs';
                    
                    // 如果有GitHub用户名，创建链接
                    if (contributor.github_username) {
                        const nameLink = document.createElement('a');
                        nameLink.href = `https://github.com/${contributor.github_username}`;
                        nameLink.target = '_blank';
                        nameLink.appendChild(nameSpan);
                        contributorsList.appendChild(nameLink);
                    } else {
                        contributorsList.appendChild(nameSpan);
                    }
                }
            });
            
            // 显示贡献者区域
            contributorsContainer.style.display = 'flex';
        } else {
            // 如果不显示贡献者，隐藏容器
            contributorsContainer.style.display = 'none';
        }
    } else {
        // 如果没有贡献者数据或元素不存在，确保容器隐藏
        if (contributorsContainer) contributorsContainer.style.display = 'none';
    }
    
    // 处理GitHub编辑链接
    // 只有当github启用且显示编辑链接时才处理
    if (githubEnabled && config.extensions?.github?.edit_link !== false) {
        const githubEditLink = document.getElementById('github-edit-link');
        const githubEditContainer = document.getElementById('github-edit-container');
        
        if (githubEditLink && githubEditContainer) {
            // 获取GitHub配置
            const repoUrl = config.extensions?.github?.repo_url || '';
            const branch = config.extensions?.github?.branch || 'main';
            
            if (repoUrl) {
                // 构建GitHub编辑链接
                const rootDir = config.document?.root_dir || 'data';
                const editUrl = `${repoUrl.replace(/\/$/, '')}/edit/${branch}/${rootDir}/${relativePath}`;
                
                githubEditLink.href = editUrl;
                
                // 显示GitHub编辑链接区域
                githubEditContainer.style.display = 'flex';
            } else {
                 // 如果没有配置repoUrl，隐藏容器
                 githubEditContainer.style.display = 'none';
            }
        } else {
            // 如果元素不存在，确保容器隐藏
            const githubEditContainer = document.getElementById('github-edit-container');
            if (githubEditContainer) githubEditContainer.style.display = 'none';
        }
    } else {
        // 如果不显示，确保容器隐藏
        const githubEditContainer = document.getElementById('github-edit-container');
        if (githubEditContainer) githubEditContainer.style.display = 'none';
    }
}

// 隐藏所有Git信息元素
function hideGitInfoElements() {
    const elements = [
        document.getElementById('last-modified'),
        document.getElementById('contributors-container'),
        document.getElementById('github-edit-container')
    ];
    
    elements.forEach(element => {
        if (element) {
            // 使用普通DOM操作替代Alpine.js
            element.style.display = 'none';
        }
    });
}

// 在mdContentLoaded事件监听器中添加处理调用
document.addEventListener('mdContentLoaded', function(event) {
    // 处理数学公式
    processKaTeXFormulas();
    
    // 处理Mermaid图表
    processMermaidDiagrams();
}); 

// 添加暗黑模式同步功能
function syncDarkMode(iframeDoc) {
    if (!iframeDoc || !iframeDoc.documentElement) return;
    
    try {
        // 检查外部文档是否是暗黑模式
        const isParentDark = document.documentElement.classList.contains('dark');
        
        // 将iframe文档的html元素设置为与父文档相同的模式
        if (isParentDark) {
            iframeDoc.documentElement.classList.add('dark');
        } else {
            iframeDoc.documentElement.classList.remove('dark');
        }
        
        // 监听外部文档暗黑模式变化
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const isParentDarkNow = document.documentElement.classList.contains('dark');
                    if (isParentDarkNow) {
                        iframeDoc.documentElement.classList.add('dark');
                    } else {
                        iframeDoc.documentElement.classList.remove('dark');
                    }
                }
            });
        });
        
        // 设置观察器选项
        const observerConfig = { attributes: true };
        
        // 开始观察document.documentElement的class变化
        observer.observe(document.documentElement, observerConfig);
        
        // 添加暗黑模式样式到iframe中
        const darkModeStyle = iframeDoc.createElement('style');
        darkModeStyle.textContent = `
            /* 基本暗黑模式样式 */
            .dark {
                color-scheme: dark;
            }
            
            .dark body {
                background-color: #1F2937;
                color: #f3f4f6;
            }
        `;
        
        // 将样式添加到iframe的head中
        iframeDoc.head.appendChild(darkModeStyle);
    } catch (e) {
        console.warn('同步暗黑模式失败:', e);
    }
}

// 从iframe中生成目录
function generateTocFromIframe(iframeDoc, tocNav) {
    tocNav.innerHTML = '';
    
    // 获取配置的目录深度
    const tocDepth = config.document.toc_depth || 3;
    
    // 构建标题选择器，仅选择配置的深度内的标题
    let headingSelector = '';
    for (let i = 1; i <= tocDepth; i++) {
        headingSelector += (headingSelector ? ', ' : '') + 'h' + i;
    }
    
    // 查找iframe中符合深度要求的标题元素
    const headings = iframeDoc.querySelectorAll(headingSelector);
    
    // 是否显示标题编号
    const showNumbering = config.document.toc_numbering || false;
    // 是否忽略h1标题计数
    const ignoreH1 = config.document.toc_ignore_h1 || false;
    
    // 用于生成标题编号的计数器
    const counters = [0, 0, 0, 0, 0, 0];
    let lastLevel = 0;
    
    const headingsArray = Array.from(headings);
    
    if (headingsArray.length === 0) {
        tocNav.innerHTML = '<p class="text-gray-400 text-sm">暂无目录</p>';
        return; // 如果没有标题，直接返回
    }
    
    headingsArray.forEach((heading, index) => {
        const level = parseInt(heading.tagName.substring(1));

        // 如果标题没有ID，添加一个
        if (!heading.id) {
            heading.id = `iframe-heading-${index}`;
        }
        const id = heading.id;
        
        // 处理标题编号
        let prefix = '';
        if (showNumbering) {
            // 如果设置了忽略h1并且当前是h1，不生成编号
            if (ignoreH1 && level === 1) {
                prefix = '';
            } else {
                // 更新计数器，对h1做特殊处理
                if (level > lastLevel) {
                    // 如果新标题级别比上一个大，将所有更深层级的计数器重置为0
                    for (let i = lastLevel; i < level; i++) {
                        // 如果忽略h1，并且是处理h1计数器，则跳过
                        if (!(ignoreH1 && i === 0)) {
                            counters[i]++;
                        }
                    }
                    for (let i = level; i < counters.length; i++) {
                        counters[i] = 0;
                    }
                } else if (level === lastLevel) {
                    // 如果新标题与上一个同级，递增计数器
                    // 如果忽略h1，并且是处理h1计数器，则跳过
                    if (!(ignoreH1 && level === 1)) {
                        counters[level - 1]++;
                    }
                } else {
                    // 如果新标题比上一个小（更高级别），递增当前级别并重置更低级别
                    // 如果忽略h1，并且是处理h1计数器，则跳过
                    if (!(ignoreH1 && level === 1)) {
                        counters[level - 1]++;
                    }
                    for (let i = level; i < counters.length; i++) {
                        counters[i] = 0;
                    }
                }
                
                // 生成标题编号，注意对h1的特殊处理
                prefix = '';
                // 如果忽略h1，则从h2开始计数
                const startIdx = ignoreH1 ? 1 : 0;
                for (let i = startIdx; i < level; i++) {
                    if (counters[i] > 0) {
                        prefix += counters[i] + '.';
                    }
                }
                prefix = prefix ? `${prefix} ` : '';
            }
        }
        
        lastLevel = level;

        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `javascript:void(0);`; // 改为使用JavaScript事件而不是锚链接
        a.innerHTML = prefix + heading.textContent; 
        a.classList.add('block', 'text-sm', 'py-1', 'hover:text-primary', 'dark:hover:text-primary');
        a.style.marginLeft = `${(level - 1) * 0.75}rem`; // 缩进
        a.dataset.headingId = id;
        
        // 点击目录条目时滚动到iframe内部对应标题
        a.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 获取当前激活的iframe元素
            const iframes = document.querySelectorAll('.iframe-container iframe');
            if (iframes.length > 0) {
                // 查找可见的iframe
                let activeIframe = null;
                for (const iframe of iframes) {
                    if (iframe.offsetParent !== null) { // 检查iframe是否可见
                        activeIframe = iframe;
                        break;
                    }
                }
                
                if (activeIframe) {
                    try {
                        // console.log('尝试滚动到标题:', id);
                        // 使用iframe中的document获取标题元素
                        const targetHeading = activeIframe.contentWindow.document.getElementById(id);
                        if (targetHeading) {
                            // console.log('找到标题元素:', targetHeading);
                            
                            // 获取iframe在页面中的位置
                            const iframeRect = activeIframe.getBoundingClientRect();
                            // 获取标题在iframe中的位置
                            const headingRect = targetHeading.getBoundingClientRect();
                            
                            // 计算标题在页面中的绝对位置 = iframe在页面中的位置 + 标题在iframe中的位置
                            const absoluteHeadingTop = window.scrollY + iframeRect.top + headingRect.top;
                            
                            // console.log('滚动主页面到位置:', absoluteHeadingTop);
                            
                            // 滚动主页面到标题位置
                            window.scrollTo({
                                top: absoluteHeadingTop - 80, // 减去一些顶部空间，使标题不会太靠上
                                behavior: 'smooth'
                            });
                            
                            // 更新URL hash但不触发页面跳转
                            history.pushState(null, null, `#${id}`);
                            
                            // 高亮当前目录项
                            document.querySelectorAll('#toc-nav a').forEach(link => link.classList.remove('active'));
                            a.classList.add('active');
                            
                            // 确保当前目录项在视图中
                            scrollTocToActiveItem(a);
                        } else {
                            console.error('未找到目标标题元素:', id);
                        }
                    } catch (error) {
                        console.error('滚动到iframe标题错误:', error);
                    }
                }
            }
        });
        
        li.appendChild(a);
        tocNav.appendChild(li);
    });
    
    // 监听iframe滚动事件，高亮当前可见标题的目录项
    try {
        const iframe = document.querySelector('.iframe-container iframe');
        if (iframe) {
            // 使用setTimeout确保iframe完全加载
            setTimeout(() => {
                try {
                    // 监听iframe的滚动事件
                    iframe.contentWindow.addEventListener('scroll', debounce(() => {
                        updateIframeTocHighlight(iframe);
                    }, 100));
                    
                    // 监听主文档的滚动事件
                    window.addEventListener('scroll', debounce(() => {
                        updateIframeTocHighlight(iframe);
                    }, 100));
                    
                    // 初始调用一次
                    updateIframeTocHighlight(iframe);
                } catch (e) {
                    console.warn('添加iframe滚动事件监听器失败:', e);
                }
            }, 500);
        }
    } catch (error) {
        console.warn('无法监听iframe滚动事件:', error);
    }
}

// 更新HTML文档的目录高亮
function updateIframeTocHighlight(iframe) {
    try {
        if (!iframe || !iframe.contentWindow || !iframe.contentWindow.document) {
            return;
        }
        
        const iframeDoc = iframe.contentWindow.document;
        
        // 获取配置的目录深度
        const tocDepth = config.document.toc_depth || 3;
        
        // 构建标题选择器，仅选择配置的深度内的标题
        let headingSelector = '';
        for (let i = 1; i <= tocDepth; i++) {
            headingSelector += (headingSelector ? ', ' : '') + 'h' + i;
        }
        
        // 查找符合深度要求的标题元素
        const headingElements = iframeDoc.querySelectorAll(headingSelector);
        
        if (headingElements.length === 0) {
            return;
        }
        
        // 获取iframe在页面中的位置
        const iframeRect = iframe.getBoundingClientRect();
        
        // 计算视口中间位置
        const viewportMiddle = window.innerHeight / 3; // 使用视口上部1/3处作为参考点
        
        // 跟踪最接近视口中间的标题及其距离
        let closestHeading = null;
        let closestDistance = Infinity;
        
        // 遍历所有标题，查找最接近视口中间的标题
        headingElements.forEach(heading => {
            // 获取标题在iframe内的位置
            const headingRect = heading.getBoundingClientRect();
            
            // 计算标题在页面中的绝对位置
            const headingAbsTop = iframeRect.top + headingRect.top;
            
            // 计算标题与视口中间的距离
            const distance = Math.abs(headingAbsTop - viewportMiddle);
            
            // 如果这个标题是可见的，并且距离比之前找到的更近
            if (
                headingAbsTop > 0 && 
                headingAbsTop < window.innerHeight && 
                distance < closestDistance
            ) {
                closestHeading = heading;
                closestDistance = distance;
            }
        });
        
        // 如果没有找到可见标题，尝试找最后一个已经滚过的标题
        if (!closestHeading) {
            let lastPassedHeading = null;
            
            // 找出最后一个已经过去的标题
            for (let i = headingElements.length - 1; i >= 0; i--) {
                const heading = headingElements[i];
                const headingRect = heading.getBoundingClientRect();
                const headingAbsTop = iframeRect.top + headingRect.top;
                
                if (headingAbsTop < viewportMiddle) {
                    lastPassedHeading = heading;
                    break;
                }
            }
            
            closestHeading = lastPassedHeading;
        }
        
        // 高亮对应目录项
        if (closestHeading && closestHeading.id) {
            const tocLinks = document.querySelectorAll('#toc-nav a');
            let activeTocLink = null;
            
            tocLinks.forEach(link => {
                link.classList.remove('active');
                if (link.dataset.headingId === closestHeading.id) {
                    link.classList.add('active');
                    activeTocLink = link;
                }
            });
            
            // 确保当前活动的目录项在视图中
            if (activeTocLink) {
                scrollTocToActiveItem(activeTocLink);
            }
        }
    } catch (e) {
        console.warn('更新iframe目录高亮出错:', e);
    }
}