/**
 * 配置验证和默认值处理模块
 * 负责验证配置项的数据类型，应用默认值，并确保向后兼容性
 */

// 配置验证规则
const VALIDATION_RULES = {
    'animation.enable': {
        type: 'boolean',
        default: true,
        description: '动画总开关'
    },
    'extensions.progress_bar.enable': {
        type: 'boolean', 
        default: true,
        description: '进度条显示控制'
    },
    'extensions.cache_menu.enable': {
        type: 'boolean',
        default: true,
        description: '缓存菜单显示控制'
    },
    'document.branch_support': {
        type: 'boolean',
        default: false,
        description: '是否启用分支支持'
    },
    'document.default_branch': {
        type: 'string',
        default: 'main',
        description: '默认分支名称'
    },
    'document.available_branches': {
        type: 'object',
        default: [],
        description: '可用分支列表'
    },
    'home.use_file': {
        type: 'boolean',
        default: false,
        description: '首页是否使用外部文件'
    },
    'home.file_path': {
        type: 'string',
        default: '/home.html',
        description: '首页外部文件路径'
    }
};

/**
 * 验证配置对象并应用默认值
 * @param {Object} config - 原始配置对象
 * @returns {Object} 验证后的配置对象
 */
export function validateAndApplyDefaults(config) {
    // 创建配置副本，避免修改原始对象
    const validatedConfig = JSON.parse(JSON.stringify(config));
    
    // 确保必要的配置节存在
    if (!validatedConfig.animation) {
        validatedConfig.animation = {};
    }
    if (!validatedConfig.extensions) {
        validatedConfig.extensions = {};
    }
    if (!validatedConfig.extensions.progress_bar) {
        validatedConfig.extensions.progress_bar = {};
    }
    if (!validatedConfig.extensions.cache_menu) {
        validatedConfig.extensions.cache_menu = {};
    }
    if (!validatedConfig.home) {
        validatedConfig.home = {};
    }
    
    // 验证每个配置项
    for (const [path, rule] of Object.entries(VALIDATION_RULES)) {
        const value = getNestedValue(validatedConfig, path);
        const validatedValue = validateConfigValue(value, rule, path);
        setNestedValue(validatedConfig, path, validatedValue);
    }
    
    return validatedConfig;
}

/**
 * 验证单个配置值
 * @param {*} value - 配置值
 * @param {Object} rule - 验证规则
 * @param {string} path - 配置路径
 * @returns {*} 验证后的值
 */
function validateConfigValue(value, rule, path) {
    // 如果值不存在，使用默认值
    if (value === undefined || value === null) {
        console.info(`配置项 ${path} 未设置，使用默认值: ${rule.default}`);
        return rule.default;
    }
    
    // 检查类型
    const actualType = typeof value;
    if (actualType !== rule.type) {
        console.warn(`配置项 ${path} 类型错误: 期望 ${rule.type}，实际 ${actualType}，使用默认值: ${rule.default}`);
        return rule.default;
    }
    
    return value;
}

/**
 * 获取嵌套对象的值
 * @param {Object} obj - 对象
 * @param {string} path - 路径，如 'animation.enable'
 * @returns {*} 值
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}

/**
 * 设置嵌套对象的值
 * @param {Object} obj - 对象
 * @param {string} path - 路径，如 'animation.enable'
 * @param {*} value - 值
 */
function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    // 创建嵌套路径
    const target = keys.reduce((current, key) => {
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
        }
        return current[key];
    }, obj);
    
    target[lastKey] = value;
}

/**
 * 检查配置的向后兼容性
 * @param {Object} config - 配置对象
 * @returns {boolean} 是否兼容
 */
export function checkBackwardCompatibility(config) {
    let isCompatible = true;
    
    // 检查是否存在已废弃的配置项
    // 目前没有废弃的配置项，但为将来扩展预留
    
    // 检查必要的基础配置是否存在
    const requiredSections = ['site', 'appearance', 'layout', 'navigation', 'document', 'home'];
    for (const section of requiredSections) {
        if (!config[section]) {
            console.error(`缺少必要的配置节: ${section}`);
            isCompatible = false;
        }
    }
    
    return isCompatible;
}

/**
 * 获取配置验证报告
 * @param {Object} originalConfig - 原始配置
 * @param {Object} validatedConfig - 验证后的配置
 * @returns {Object} 验证报告
 */
export function getValidationReport(originalConfig, validatedConfig) {
    const report = {
        hasChanges: false,
        appliedDefaults: [],
        typeCorrections: [],
        warnings: []
    };
    
    // 检查每个验证规则
    for (const [path, rule] of Object.entries(VALIDATION_RULES)) {
        const originalValue = getNestedValue(originalConfig, path);
        const validatedValue = getNestedValue(validatedConfig, path);
        
        if (originalValue === undefined || originalValue === null) {
            report.hasChanges = true;
            report.appliedDefaults.push({
                path,
                defaultValue: validatedValue,
                description: rule.description
            });
        } else if (typeof originalValue !== rule.type) {
            report.hasChanges = true;
            report.typeCorrections.push({
                path,
                originalValue,
                originalType: typeof originalValue,
                correctedValue: validatedValue,
                expectedType: rule.type,
                description: rule.description
            });
        }
    }
    
    return report;
}

/**
 * 打印验证报告到控制台
 * @param {Object} report - 验证报告
 */
export function printValidationReport(report) {
    if (!report.hasChanges) {
        console.info('配置验证完成，所有配置项均正确');
        return;
    }
    
    console.group('配置验证报告');
    
    if (report.appliedDefaults.length > 0) {
        console.group('应用的默认值:');
        report.appliedDefaults.forEach(item => {
            console.info(`${item.path}: ${item.defaultValue} (${item.description})`);
        });
        console.groupEnd();
    }
    
    if (report.typeCorrections.length > 0) {
        console.group('类型错误修正:');
        report.typeCorrections.forEach(item => {
            console.warn(`${item.path}: ${item.originalValue} (${item.originalType}) → ${item.correctedValue} (${item.expectedType}) - ${item.description}`);
        });
        console.groupEnd();
    }
    
    if (report.warnings.length > 0) {
        console.group('警告:');
        report.warnings.forEach(warning => {
            console.warn(warning);
        });
        console.groupEnd();
    }
    
    console.groupEnd();
}