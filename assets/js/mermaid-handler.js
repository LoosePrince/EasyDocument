/**
 * Mermaid图表处理模块
 */
import config from '../../config.js';

// 监听暗黑模式变化
const darkModeObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        if (mutation.attributeName === 'class') {
            const isDarkMode = document.documentElement.classList.contains('dark');
            // 切换代码高亮主题
            document.querySelector('link[href*="github.min.css"]').media = isDarkMode ? 'not all' : 'all';
            document.querySelector('link[href*="github-dark.min.css"]').media = isDarkMode ? 'all' : 'not all';
            
            // 重新初始化Mermaid以适应暗黑模式
            updateMermaidTheme(isDarkMode);
        }
    });
});

// 开始观察html元素上的class变化
darkModeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
});

// 更新Mermaid主题
export function updateMermaidTheme(isDarkMode) {
    // 检查是否启用了Mermaid支持
    if (!config.extensions.mermaid) return;

    // 更新Mermaid配置
    mermaid.initialize({ 
        startOnLoad: false,
        theme: isDarkMode ? 'dark' : 'default',
        darkMode: isDarkMode,
        themeVariables: {
            // 暗黑模式变量
            dark: {
                mainBkg: '#242424',
                nodeBkg: '#333',
                nodeBorder: '#555',
                lineColor: '#d3d3d3',  // 线条和箭头颜色
                edgeLabelBackground: '#333',
                textColor: '#e0e0e0'   // 文本颜色
            }
        }
    });
    
    // 尝试重新渲染页面上的所有Mermaid图表
    const mermaidDivs = document.querySelectorAll('.mermaid');
    if (mermaidDivs.length > 0) {
        // 清除旧内容，保存原始文本
        const mermaidContents = [];
        mermaidDivs.forEach(div => {
            // 如果还没有渲染过，div的类会包含"mermaid"
            if (div.getAttribute('data-processed') === 'true') {
                // 获取原始内容
                const originalContent = div.getAttribute('data-original') || div.textContent;
                mermaidContents.push(originalContent);
                // 重置div
                div.removeAttribute('data-processed');
                div.innerHTML = originalContent;
            } else {
                // 保存原始内容
                div.setAttribute('data-original', div.textContent);
                mermaidContents.push(div.textContent);
            }
        });
        
        // 重新渲染
        setTimeout(() => {
            mermaid.init(undefined, mermaidDivs);
        }, 100);
    }
}

// 初始化 Mermaid（全局配置）
export function initializeMermaid() {
    // 检查是否启用了Mermaid支持
    if (!config.extensions.mermaid) return;

    mermaid.initialize({ 
        startOnLoad: false,  // 改为false，我们会在文档加载后手动初始化
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
        darkMode: document.documentElement.classList.contains('dark'), // 明确设置暗黑模式
        themeVariables: {
            // 暗黑模式变量
            dark: {
                mainBkg: '#242424',
                nodeBkg: '#333',
                nodeBorder: '#555',
                lineColor: '#d3d3d3',  // 线条和箭头颜色
                edgeLabelBackground: '#333',
                textColor: '#e0e0e0'   // 文本颜色
            }
        }
    });
}

// 处理文档中的Mermaid图表
export function processMermaidDiagrams() {
    // 检查是否启用了Mermaid支持
    if (!config.extensions.mermaid) return;

    setTimeout(() => {
        try {
            // 选择所有mermaid代码块
            const mermaidBlocks = document.querySelectorAll('pre code.language-mermaid');
            mermaidBlocks.forEach(block => {
                // 创建新的div并设置为mermaid类
                const mermaidDiv = document.createElement('div');
                mermaidDiv.className = 'mermaid';
                mermaidDiv.textContent = block.textContent;
                // 保存原始内容，以便主题切换时重新渲染
                mermaidDiv.setAttribute('data-original', block.textContent);
                
                // 替换pre元素
                const preBlock = block.closest('pre');
                if (preBlock && preBlock.parentNode) {
                    preBlock.parentNode.replaceChild(mermaidDiv, preBlock);
                }
            });
            
            // 获取当前主题
            const isDarkMode = document.documentElement.classList.contains('dark');
            
            // 确保初始化配置与当前主题匹配
            mermaid.initialize({ 
                startOnLoad: false,
                theme: isDarkMode ? 'dark' : 'default',
                darkMode: isDarkMode,
                themeVariables: {
                    dark: {
                        mainBkg: '#242424',
                        nodeBkg: '#333',
                        nodeBorder: '#555',
                        lineColor: '#d3d3d3', 
                        edgeLabelBackground: '#333',
                        textColor: '#e0e0e0'
                    }
                }
            });
            
            // 重新初始化mermaid
            mermaid.init(undefined, document.querySelectorAll('.mermaid'));
        } catch (err) {
            console.error('Mermaid初始化错误:', err);
        }
    }, 100);
} 