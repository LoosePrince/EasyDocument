/**
 * 进度条模块
 * 包含顶部加载进度条和阅读进度条的功能
 */
import config from './validated-config.js';

let progressBar = null; // 顶部加载进度条元素

/**
 * 创建顶部加载进度条
 */
export function createProgressBar() {
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

/**
 * 创建阅读进度条
 */
export function createReadingProgressBar() {
    // 创建进度条容器
    const readingProgressBar = document.createElement('div');
    readingProgressBar.id = 'reading-progress-bar';
    
    // 根据配置决定是否显示进度条
    let className = 'fixed top-0 left-0 w-full h-1 bg-gray-200 dark:bg-gray-700 z-40';
    if (!config.extensions.progress_bar.enable) {
        className += ' hidden'; // 通过 CSS 类隐藏进度条
    }
    readingProgressBar.className = className;
    
    // 创建进度条内部填充
    const progressFill = document.createElement('div');
    progressFill.id = 'reading-progress-fill';
    progressFill.className = 'h-full bg-primary transition-all duration-100 ease-out';
    progressFill.style.width = '0%';
    
    // 组装进度条
    readingProgressBar.appendChild(progressFill);
    document.body.appendChild(readingProgressBar);
    
    // 只有在启用进度条时才添加滚动监听器
    if (config.extensions.progress_bar.enable) {
        window.addEventListener('scroll', updateReadingProgress);
        
        // 初始更新一次进度
        setTimeout(updateReadingProgress, 500);
    }
}

/**
 * 更新阅读进度
 */
export function updateReadingProgress() {
    // 如果进度条被禁用，直接返回
    if (!config.extensions.progress_bar.enable) return;
    
    const contentDiv = document.getElementById('document-content');
    if (!contentDiv) return;

    // 获取文档内容区域的位置和尺寸
    const contentRect = contentDiv.getBoundingClientRect();
    const contentTop = contentRect.top + window.scrollY;
    const contentHeight = contentDiv.offsetHeight;
    
    // 如果内容高度太小，不显示进度条
    if (contentHeight < window.innerHeight * 1.5) {
        const progressBar = document.getElementById('reading-progress-bar');
        if (progressBar) progressBar.style.opacity = '0';
        return;
    } else {
        const progressBar = document.getElementById('reading-progress-bar');
        if (progressBar) progressBar.style.opacity = '1';
    }
    
    // 获取当前滚动位置
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    
    // 计算阅读进度
    // 考虑到窗口高度，我们应该在用户接近底部时显示为100%
    const viewportHeight = window.innerHeight;
    const readableHeight = contentHeight - viewportHeight;
    
    // 计算已阅读的高度（当前滚动位置减去内容区域顶部位置）
    const readHeight = Math.max(0, scrollTop - contentTop);
    
    // 计算阅读进度百分比
    const progress = Math.min(100, Math.round((readHeight / readableHeight) * 100));
    
    // 更新进度条
    const progressFill = document.getElementById('reading-progress-fill');
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
}

/**
 * 显示顶部加载进度条
 */
export function showProgressBar() {
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

/**
 * 更新顶部加载进度条
 * @param {number} percentage 进度百分比 (0-100)
 */
export function updateProgressBar(percentage) {
    if (!progressBar) return;
    
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
}

/**
 * 隐藏顶部加载进度条
 */
export function hideProgressBar() {
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

/**
 * 显示阅读进度条
 */
export function showReadingProgressBar() {
    const readingProgressBar = document.getElementById('reading-progress-bar');
    if (readingProgressBar) {
        readingProgressBar.classList.remove('hidden');
        // 重新添加滚动监听器（如果之前被移除）
        window.addEventListener('scroll', updateReadingProgress);
        // 立即更新一次进度
        setTimeout(updateReadingProgress, 100);
    }
}

/**
 * 隐藏阅读进度条
 */
export function hideReadingProgressBar() {
    const readingProgressBar = document.getElementById('reading-progress-bar');
    if (readingProgressBar) {
        readingProgressBar.classList.add('hidden');
        // 移除滚动监听器以节省性能
        window.removeEventListener('scroll', updateReadingProgress);
    }
}

/**
 * 切换阅读进度条显示状态
 * @param {boolean} enable - 是否启用进度条
 */
export function toggleReadingProgressBar(enable) {
    if (enable) {
        showReadingProgressBar();
    } else {
        hideReadingProgressBar();
    }
} 