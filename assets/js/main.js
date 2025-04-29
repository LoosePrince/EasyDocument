/**
 * 主应用入口文件
 * 负责初始化应用和加载配置
 */
import config from '../../config.js';
import { initDarkMode, initThemeEvents } from './theme.js';
import { generateNavLinks, generateMobileNavLinks, updateFooterElements } from './navigation.js';

// 搜索数据
let searchData = null;

// 应用初始化
export async function initApp() {
    // 设置页面标题和元数据
    document.title = `${config.site.name} - ${config.site.title}`;
    document.querySelector('meta[name="description"]').content = config.site.description;
    document.querySelector('meta[name="keywords"]').content = config.site.keywords;
    document.querySelector('link[rel="icon"]').href = config.appearance.favicon;
    
    // 初始化主题
    initDarkMode(config);
    
    // 应用主题色
    document.documentElement.style.setProperty('--color-primary', config.appearance.theme_color);
    
    // 应用字体设置
    if (config.appearance.font_family) {
        document.body.style.fontFamily = config.appearance.font_family;
    }
    
    // 加载头部和底部
    await loadHeaderAndFooter();
    
    // 初始化搜索功能
    initSearch();
    
    // Alpine.js初始化问题修复
    fixAlpineInit();
}

// 加载头部和底部
async function loadHeaderAndFooter() {
    try {
        // 加载头部
        if (config.layout.show_header) {
            if (config.layout.use_custom_header) {
                await loadCustomHeader();
            } else {
                loadDefaultHeader();
            }
        }
        
        // 加载底部
        if (config.layout.show_footer) {
            if (config.layout.use_custom_footer) {
                await loadCustomFooter();
            } else {
                loadDefaultFooter();
            }
        }
    } catch (error) {
        console.error('加载头部或底部失败:', error);
    }
}

// 加载自定义头部
async function loadCustomHeader() {
    const headerFile = config.layout.header_file;
    const headerResponse = await fetch(headerFile);
    const headerHtml = await headerResponse.text();
    document.getElementById('header-container').innerHTML = headerHtml;
    
    // 延迟执行绑定切换按钮事件，确保DOM元素已加载完成
    setTimeout(() => {
        bindThemeToggleEvents();
        bindSearchEvents(); // 绑定搜索事件
    }, 100);
}

// 加载默认头部
function loadDefaultHeader() {
    document.getElementById('header-container').innerHTML = `
    <header class="bg-white dark:bg-gray-800 shadow-sm h-16" x-data="{ mobileMenuOpen: false }">
        <div class="container mx-auto px-4 h-full relative">
            <div class="flex justify-between items-center h-full">
                <div class="flex items-center space-x-2">
                    <img src="${config.appearance.logo}" alt="${config.site.name}" class="site-logo h-8 w-8">
                    <span class="text-lg font-bold">
                        ${formatSiteName(config.site.name)}
                    </span>
                </div>
                <div class="flex items-center space-x-4">
                    <nav class="hidden md:flex space-x-6">
                        ${generateNavLinks(config.navigation.nav_links)}
                    </nav>
                    
                    <!-- 搜索按钮 -->
                    <button id="search-button" class="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none">
                        <i class="fas fa-search text-gray-600 dark:text-gray-300"></i>
                    </button>
                    
                    <button id="dark-mode-toggle" class="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none">
                        <i class="fas fa-moon dark:hidden text-gray-600"></i>
                        <i class="fas fa-sun hidden dark:block text-yellow-300"></i>
                    </button>
                    
                    <!-- 移动端菜单按钮 -->
                    <button @click="mobileMenuOpen = !mobileMenuOpen" class="md:hidden w-10 h-10 rounded flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none">
                        <i class="fas fa-bars text-gray-600 dark:text-gray-300"></i>
                    </button>
                </div>
            </div>
            
            <!-- 移动端菜单 -->
            <div x-show="mobileMenuOpen" 
                x-transition:enter="transition ease-out duration-200" 
                x-transition:enter-start="opacity-0 -translate-y-2" 
                x-transition:enter-end="opacity-100 translate-y-0" 
                x-transition:leave="transition ease-in duration-150" 
                x-transition:leave-start="opacity-100 translate-y-0" 
                x-transition:leave-end="opacity-0 -translate-y-2" 
                class="md:hidden py-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800 absolute left-0 right-0 z-50 shadow-md" 
                style="display: none; top: 4rem;">
                <div class="container mx-auto px-4">
                    <nav class="flex flex-col space-y-4">
                        ${generateMobileNavLinks(config.navigation.nav_links)}
                    </nav>
                </div>
            </div>
        </div>
    </header>
    
    <!-- 搜索模态窗口 -->
    <div id="search-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 hidden">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
            <div class="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white">搜索文档</h3>
                <button id="close-search-modal" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <i class="fas fa-times text-gray-600 dark:text-gray-300"></i>
                </button>
            </div>
            <div class="p-4">
                <div class="relative">
                    <input id="search-input" type="text" placeholder="输入关键词..." class="w-full px-4 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary">
                    <button id="do-search" class="absolute right-2 top-2 text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
                <div id="search-results" class="mt-4 max-h-96 overflow-y-auto">
                    <!-- 搜索结果将在这里显示 -->
                </div>
            </div>
        </div>
    </div>`;
    
    // 绑定主题切换事件
    setTimeout(() => {
        bindThemeToggleEvents();
        bindSearchEvents(); // 绑定搜索事件
    }, 100);
}

// 绑定主题切换按钮事件
function bindThemeToggleEvents() {
    const toggleButtons = document.querySelectorAll('[id^="dark-mode-toggle"]');
    
    toggleButtons.forEach(button => {
        // 移除已有的事件监听器，避免重复绑定
        button.removeEventListener('click', handleThemeToggle);
        
        // 添加新的事件监听器
        button.addEventListener('click', handleThemeToggle);
    });
    
    // 更新按钮的初始状态
    import('./theme.js').then(({ updateThemeToggleButton }) => {
        updateThemeToggleButton();
    });
}

// 初始化搜索功能
function initSearch() {
    // 加载搜索数据
    loadSearchData();
    
    // 绑定搜索相关事件
    bindSearchEvents();
}

// 加载搜索数据
async function loadSearchData() {
    try {
        const response = await fetch('search.json');
        if (response.ok) {
            searchData = await response.json();
            console.log('搜索数据加载成功，共 ' + searchData.length + ' 条记录');
        } else {
            console.warn('搜索数据加载失败: ' + response.status);
        }
    } catch (error) {
        console.error('加载搜索数据出错:', error);
    }
}

// 绑定搜索相关事件
function bindSearchEvents() {
    // 搜索按钮点击事件
    const searchButton = document.getElementById('search-button');
    if (searchButton) {
        searchButton.addEventListener('click', openSearchModal);
    }
    
    // 关闭搜索模态窗口按钮事件
    const closeButton = document.getElementById('close-search-modal');
    if (closeButton) {
        closeButton.addEventListener('click', closeSearchModal);
    }
    
    // 执行搜索按钮点击事件
    const doSearchButton = document.getElementById('do-search');
    if (doSearchButton) {
        doSearchButton.addEventListener('click', performSearch);
    }
    
    // 输入框回车键事件
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                performSearch();
            }
        });
    }
    
    // 点击模态窗口外部关闭
    const searchModal = document.getElementById('search-modal');
    if (searchModal) {
        searchModal.addEventListener('click', function(event) {
            if (event.target === searchModal) {
                closeSearchModal();
            }
        });
    }
}

// 打开搜索模态窗口
function openSearchModal() {
    const modal = document.getElementById('search-modal');
    if (modal) {
        modal.classList.remove('hidden');
        
        // 聚焦到搜索输入框
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            setTimeout(() => {
                searchInput.focus();
            }, 100);
        }
    }
}

// 关闭搜索模态窗口
function closeSearchModal() {
    const modal = document.getElementById('search-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 执行搜索
function performSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResultsContainer = document.getElementById('search-results');
    
    if (!searchInput || !searchResultsContainer) return;
    
    const query = searchInput.value.trim().toLowerCase();
    
    if (query.length < 2) {
        searchResultsContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">请输入至少2个字符</p>';
        return;
    }
    
    if (!searchData || searchData.length === 0) {
        searchResultsContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">搜索数据未加载，请稍后重试</p>';
        return;
    }
    
    // 执行搜索
    const results = searchData.filter(item => {
        const titleMatch = item.title.toLowerCase().includes(query);
        const contentMatch = item.content.toLowerCase().includes(query);
        const keywordMatch = item.keywords && item.keywords.some(keyword => keyword.toLowerCase().includes(query));
        
        return titleMatch || contentMatch || keywordMatch;
    });
    
    // 显示搜索结果
    if (results.length === 0) {
        searchResultsContainer.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">未找到匹配的结果</p>';
    } else {
        let html = '<ul class="space-y-3">';
        
        results.forEach(result => {
            // 构建URL
            let url = 'main.html?path=' + result.path;
            
            // 提取匹配的内容片段
            let contentPreview = extractContentPreview(result.content, query);
            
            html += `
            <li class="border-b dark:border-gray-700 pb-3">
                <a href="${url}" class="block hover:bg-gray-50 dark:hover:bg-gray-700 rounded p-2" onclick="closeSearchModal()">
                    <h4 class="text-primary font-medium">${highlightText(result.title, query)}</h4>
                    <p class="text-gray-600 dark:text-gray-300 text-sm line-clamp-2 mt-1">${contentPreview}</p>
                    <div class="text-gray-500 dark:text-gray-400 text-xs mt-1 flex items-center">
                        <i class="fas fa-file-alt mr-1"></i> ${result.path}
                    </div>
                </a>
            </li>`;
        });
        
        html += '</ul>';
        searchResultsContainer.innerHTML = html;
        
        // 为搜索结果中的链接添加点击事件
        searchResultsContainer.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function() {
                closeSearchModal();
            });
        });
    }
}

// 提取匹配的内容片段
function extractContentPreview(content, query) {
    if (!content) return '';
    
    const lowerContent = content.toLowerCase();
    const queryIndex = lowerContent.indexOf(query.toLowerCase());
    
    if (queryIndex === -1) return content.slice(0, 150) + '...';
    
    // 尝试提取包含查询词的上下文
    const startIndex = Math.max(0, queryIndex - 60);
    const endIndex = Math.min(content.length, queryIndex + query.length + 60);
    let preview = content.slice(startIndex, endIndex);
    
    // 在开头和结尾添加省略号
    if (startIndex > 0) preview = '...' + preview;
    if (endIndex < content.length) preview = preview + '...';
    
    return highlightText(preview, query);
}

// 高亮显示文本中的匹配部分
function highlightText(text, query) {
    if (!text || !query) return text;
    
    const regex = new RegExp('(' + query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + ')', 'gi');
    return text.replace(regex, '<span class="bg-yellow-200 dark:bg-yellow-800">$1</span>');
}

// 处理主题切换点击事件
function handleThemeToggle() {
    import('./theme.js').then(({ toggleDarkMode }) => {
        toggleDarkMode();
    });
}

// 加载自定义底部
async function loadCustomFooter() {
    const footerFile = config.layout.footer_file;
    const footerResponse = await fetch(footerFile);
    const footerHtml = await footerResponse.text();
    document.getElementById('footer-container').innerHTML = footerHtml;
    
    // 更新页脚元素
    updateFooterElements(config);
}

// 加载默认底部
function loadDefaultFooter() {
    document.getElementById('footer-container').innerHTML = `
    <footer class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-16">
        <div class="container mx-auto px-4 py-6 text-center">
            <p class="text-gray-600 dark:text-gray-300 copyright-text">${config.footer.copyright || '© 2024 EasyDocument'}</p>
            ${config.footer.show_powered_by ? 
            `<p class="text-gray-500 dark:text-gray-400 text-sm mt-2 powered-by-text">
                使用 <a href="https://tailwindcss.com" class="text-primary hover:underline">TailwindCSS</a> 和 
                <a href="https://alpinejs.dev" class="text-primary hover:underline">Alpine.js</a> 构建
            </p>` : ''}
            <p class="text-gray-500 dark:text-gray-400 text-sm mt-1 site-description">${config.site.description}</p>
        </div>
        
        <!-- 添加隐藏的导航链接和页脚链接容器，以便JS可以操作 -->
        <div class="hidden">
            <ul class="nav-links"></ul>
            <ul class="footer-links"></ul>
        </div>
    </footer>`;
    
    // 更新页脚元素
    updateFooterElements(config);
}

// 修复Alpine.js初始化问题
function fixAlpineInit() {
    // 延迟执行以确保DOM已更新
    setTimeout(() => {
        // 如果Alpine可用，初始化动态添加的元素
        if (window.Alpine) {
            document.querySelectorAll('[x-data]').forEach(el => {
                if (!el.__x) {
                    window.Alpine.initTree(el);
                }
            });
        }
        
        // 重新绑定主题切换事件
        bindThemeToggleEvents();
        
        // 重新绑定搜索事件
        bindSearchEvents();
    }, 100);
}

// 格式化网站名称
function formatSiteName(siteName) {
    // 如果名称以Easy开头，保持原有的样式
    if (siteName.match(/^Easy/i)) {
        const firstPart = siteName.substring(0, 4);
        const restPart = siteName.substring(4);
        return `<span class="text-primary">${firstPart}</span><span class="dark:text-white">${restPart}</span>`;
    } else {
        return `<span class="text-primary">${siteName}</span>`;
    }
}

// 监听DOM加载完成，初始化应用
document.addEventListener('DOMContentLoaded', initApp); 