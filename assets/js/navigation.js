/**
 * 导航相关功能
 * 负责生成导航链接和移动端菜单
 */

// 生成桌面端导航链接
export function generateNavLinks(links) {
    if (!links || !Array.isArray(links) || links.length === 0) {
        return '';
    }
    
    return links.map(link => {
        const icon = link.icon ? `<i class="fab fa-${link.icon}"></i> ` : '';
        const target = link.external ? ' target="_blank"' : '';
        return `<a href="${link.url}" class="text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-primary"${target}>${icon}${link.text}</a>`;
    }).join('');
}

// 生成移动端导航链接
export function generateMobileNavLinks(links) {
    if (!links || !Array.isArray(links) || links.length === 0) {
        return '';
    }
    
    return links.map(link => {
        const icon = link.icon ? `<i class="fab fa-${link.icon} mr-1"></i>` : '';
        const target = link.external ? ' target="_blank"' : '';
        return `<a href="${link.url}" class="text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-primary transition-colors font-medium"${target}>${icon}${link.text}</a>`;
    }).join('');
}

// 更新页脚元素
export function updateFooterElements(config) {
    // 添加版权信息
    const copyrightElement = document.querySelector('.copyright-text');
    if (copyrightElement && config.footer.copyright) {
        copyrightElement.textContent = config.footer.copyright;
    }
    
    // 添加网站描述
    const descriptionElement = document.querySelector('.site-description');
    if (descriptionElement && config.site.description) {
        descriptionElement.textContent = config.site.description;
    }
    
    // 显示技术支持信息
    const poweredByElement = document.querySelector('.powered-by-text');
    if (poweredByElement) {
        if (!config.footer.show_powered_by) {
            poweredByElement.style.display = 'none';
        }
    }
    
    // 添加页脚链接
    const footerLinksContainer = document.querySelector('.footer-links');
    if (footerLinksContainer && config.footer.links && Array.isArray(config.footer.links)) {
        footerLinksContainer.innerHTML = '';
        config.footer.links.forEach(link => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = link.url;
            a.className = 'text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-primary transition-colors';
            a.target = '_blank';
            a.textContent = link.text;
            li.appendChild(a);
            footerLinksContainer.appendChild(li);
        });
    }
    
    // 添加导航链接
    const navLinksContainer = document.querySelector('.nav-links');
    if (navLinksContainer && config.navigation.nav_links && Array.isArray(config.navigation.nav_links)) {
        navLinksContainer.innerHTML = '';
        config.navigation.nav_links.forEach(link => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = link.url;
            a.className = 'text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-primary transition-colors';
            if (link.external) {
                a.target = '_blank';
            }
            if (link.icon) {
                const icon = document.createElement('i');
                icon.className = `fab fa-${link.icon} mr-1`;
                a.appendChild(icon);
            }
            a.appendChild(document.createTextNode(link.text));
            li.appendChild(a);
            navLinksContainer.appendChild(li);
        });
    }
} 