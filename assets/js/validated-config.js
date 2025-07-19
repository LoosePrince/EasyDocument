/**
 * 验证后的配置模块
 * 提供经过验证和默认值处理的配置对象
 */
import rawConfig from '/config.js';
import { validateAndApplyDefaults, checkBackwardCompatibility, getValidationReport, printValidationReport } from './config-validator.js';

// 验证配置并应用默认值
const config = validateAndApplyDefaults(rawConfig);

// 检查向后兼容性
if (!checkBackwardCompatibility(config)) {
    console.error('配置文件存在兼容性问题，请检查配置');
}

// 生成并打印验证报告
const validationReport = getValidationReport(rawConfig, config);
printValidationReport(validationReport);

// 导出验证后的配置
export default config;