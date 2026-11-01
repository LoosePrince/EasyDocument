/**
 * 内容源抽象：构建期（Node）与运行期（浏览器）共用同一接口。
 */
export interface ContentFileInfo {
  /** 分支内路径（相对内容根） */
  path: string;
  size: number;
}

export interface ContentSource {
  /** 列出内容根下所有文件（递归，仅返回配置文件允许的扩展名由调用方过滤） */
  listFiles(): Promise<ContentFileInfo[]>;
  /** 读取文件文本内容 */
  readFile(path: string): Promise<string>;
  /** 人类可读的来源描述（错误提示用） */
  describe(): string;
}

export class ContentSourceError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ContentSourceError";
  }
}
