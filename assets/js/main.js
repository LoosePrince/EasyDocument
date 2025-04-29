/**
 * 主应用入口文件
 * 负责初始化应用和加载配置
 */
import config from '../../config.js';
import { initDarkMode, initThemeEvents } from './theme.js';
import { generateNavLinks, generateMobileNavLinks, updateFooterElements } from './navigation.js';

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
    </header>`;
    
    // 绑定主题切换事件
    setTimeout(() => {
        bindThemeToggleEvents();
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