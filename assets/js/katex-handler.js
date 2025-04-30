/**
 * KaTeX数学公式处理模块
 */

// 处理文档中的数学公式
export function processKaTeXFormulas() {
    renderMathInElement(document.getElementById('document-content'), {
        delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
        ],
        throwOnError: false
    });
}

// 预加载KaTeX字体
export function preloadKaTeXFonts() {
    const fontFiles = [
        'KaTeX_Main-Regular.woff2',
        'KaTeX_Math-Italic.woff2',
        'KaTeX_Size1-Regular.woff2',
        'KaTeX_Size2-Regular.woff2'
    ];
    
    fontFiles.forEach(fontFile => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = `https://cdn.jsdelivr.net/npm/vditor@3.9.4/dist/js/katex/fonts/${fontFile}`;
        link.as = 'font';
        link.type = 'font/woff2';
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    });
} 