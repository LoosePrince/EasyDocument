/**
 * 动画控制模块
 * 负责统一管理动画的启用/禁用逻辑，实现动画总开关功能
 */
import config from './validated-config.js';

// 缓存动画总开关状态，在系统初始化时设置，优化性能
let globalAnimationEnabled = null;

/**
 * 初始化动画控制器
 * 在系统启动时调用，缓存动画总开关状态
 */
export function initAnimationController() {
    globalAnimationEnabled = config.animation?.enable !== false;
    console.log(`动画控制器初始化完成，动画总开关: ${globalAnimationEnabled ? '启用' : '禁用'}`);
    
    // 根据动画总开关状态控制CSS动画
    updateCSSAnimationState();
}

/**
 * 更新CSS动画状态
 * 通过添加/移除CSS类来控制所有CSS动画和过渡效果
 */
function updateCSSAnimationState() {
    const body = document.body;
    
    if (!globalAnimationEnabled) {
        // 动画关闭时，添加禁用动画的CSS类
        body.classList.add('animations-disabled');
    } else {
        // 动画开启时，移除禁用动画的CSS类
        body.classList.remove('animations-disabled');
    }
}

/**
 * 检查动画是否应该启用
 * 优先检查总开关，如果总开关关闭则覆盖所有子模块设置
 * @param {string} module - 模块名称 ('sidebar', 'toc', 'article', 'general')
 * @param {string} type - 动画类型 ('enable', 'enable_skeleton', 'enable_render' 等)
 * @returns {boolean} 是否应该启用动画
 */
export function isAnimationEnabled(module = null, type = 'enable') {
    // 如果动画控制器未初始化，先初始化
    if (globalAnimationEnabled === null) {
        initAnimationController();
    }
    
    // 总开关关闭时，覆盖所有子模块设置
    if (!globalAnimationEnabled) {
        return false;
    }
    
    // 总开关开启时，按照各子模块设置执行
    if (!module) {
        return true; // 如果没有指定模块，且总开关开启，则返回true
    }
    
    // 检查具体模块的动画设置
    const moduleConfig = config.animation?.[module];
    if (!moduleConfig) {
        return true; // 如果模块配置不存在，默认启用
    }
    
    // 检查具体的动画类型设置
    const animationSetting = moduleConfig[type];
    if (animationSetting === undefined) {
        return true; // 如果设置不存在，默认启用
    }
    
    return animationSetting !== false;
}

/**
 * 获取动画配置值
 * 在总开关关闭时返回禁用动画的安全值
 * @param {string} module - 模块名称
 * @param {string} property - 配置属性名
 * @param {*} defaultValue - 默认值
 * @returns {*} 配置值
 */
export function getAnimationConfig(module, property, defaultValue = null) {
    // 如果总开关关闭，对于某些属性返回安全值
    if (!isAnimationEnabled()) {
        switch (property) {
            case 'duration':
                return 0; // 动画持续时间设为0
            case 'stagger_delay':
                return 0; // 交错延迟设为0
            case 'skeleton_duration':
                return 0; // 骨架屏动画持续时间设为0
            case 'render_duration':
                return 0; // 渲染动画持续时间设为0
            case 'min_duration':
                return 0; // 最小持续时间设为0
            default:
                return defaultValue;
        }
    }
    
    // 总开关开启时，返回实际配置值
    const moduleConfig = config.animation?.[module];
    if (!moduleConfig) {
        return defaultValue;
    }
    
    const value = moduleConfig[property];
    return value !== undefined ? value : defaultValue;
}

/**
 * 检查是否应该显示加载动画
 * 考虑总开关和最小显示时长设置
 * @returns {boolean} 是否显示加载动画
 */
export function shouldShowLoadingAnimation() {
    return isAnimationEnabled('general', 'min_duration') && 
           getAnimationConfig('general', 'min_duration', 300) > 0;
}

/**
 * 获取加载动画的最小显示时长
 * 在总开关关闭时返回0，确保不会有不必要的延迟
 * @returns {number} 最小显示时长（毫秒）
 */
export function getLoadingAnimationMinDuration() {
    if (!isAnimationEnabled()) {
        return 0;
    }
    return getAnimationConfig('general', 'min_duration', 300);
}

/**
 * 动态更新动画总开关状态
 * 用于运行时更改动画设置（如果需要）
 * @param {boolean} enabled - 是否启用动画
 */
export function setGlobalAnimationEnabled(enabled) {
    globalAnimationEnabled = enabled;
    console.log(`动画总开关已更新: ${enabled ? '启用' : '禁用'}`);
    
    // 更新CSS动画状态
    updateCSSAnimationState();
}

/**
 * 获取当前动画总开关状态
 * @returns {boolean} 动画总开关状态
 */
export function getGlobalAnimationEnabled() {
    if (globalAnimationEnabled === null) {
        initAnimationController();
    }
    return globalAnimationEnabled;
}