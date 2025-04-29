#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
EasyDocument 文档路径生成工具
用于扫描data目录下的所有文档文件，并生成path.json文件
"""

import os
import json
import argparse
import re
import sys
from pathlib import Path
from html.parser import HTMLParser

# 默认配置
DEFAULT_CONFIG = {
    "root_dir": "data",                                 # 文档根目录
    "default_page": "README.md",                        # 默认文档
    "index_pages": ["README.md", "README.html",         # 索引页文件名
                   "index.md", "index.html"], 
    "supported_extensions": [".md", ".html"],           # 支持的文档扩展名
}

# HTML解析器，用于从HTML文件中提取文本内容
class HTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.result = []
        self.skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ["script", "style"]:
            self.skip = True

    def handle_endtag(self, tag):
        if tag in ["script", "style"]:
            self.skip = False

    def handle_data(self, data):
        if not self.skip and data.strip():
            self.result.append(data.strip())

    def get_text(self):
        return " ".join(self.result)

def is_supported_file(filename, config):
    """检查文件是否为支持的文档文件"""
    ext = os.path.splitext(filename)[1].lower()
    return ext in config["supported_extensions"]

def is_index_file(filename, config):
    """检查文件是否为索引文件"""
    return filename in config["index_pages"]

def scan_directory(directory, config, relative_path=""):
    """扫描目录并生成目录结构"""
    result = {
        "title": os.path.basename(directory) if relative_path else "首页",
        "path": relative_path,
        "children": [],
        "index": None,
    }
    
    # 获取目录中的所有文件和子目录
    items = []
    try:
        items = os.listdir(directory)
    except Exception as e:
        print(f"扫描目录失败: {directory}, 错误: {e}")
        return result
    
    # 文件和子目录分开处理
    files = []
    dirs = []
    
    for item in items:
        item_path = os.path.join(directory, item)
        if os.path.isfile(item_path) and is_supported_file(item, config):
            files.append(item)
        elif os.path.isdir(item_path) and not item.startswith('.'):
            dirs.append(item)
    
    # 首先处理索引文件
    for item in files:
        if is_index_file(item, config):
            item_path = os.path.join(relative_path, item)
            result["index"] = {
                "title": get_file_title(os.path.join(directory, item), item) or "文档首页",
                "path": item_path,
            }
            break
    
    # 处理其他文件
    for item in sorted(files):
        if not is_index_file(item, config):
            item_path = os.path.join(relative_path, item)
            result["children"].append({
                "title": get_file_title(os.path.join(directory, item), item),
                "path": item_path,
                "children": []
            })
    
    # 处理子目录
    for item in sorted(dirs):
        sub_dir_path = os.path.join(directory, item)
        sub_rel_path = os.path.join(relative_path, item)
        sub_result = scan_directory(sub_dir_path, config, sub_rel_path)
        
        # 只添加非空的子目录
        if sub_result["children"] or sub_result["index"]:
            result["children"].append(sub_result)
    
    return result

def get_file_title(file_path, fallback_name):
    """尝试从文件内容中提取标题，如果失败则使用文件名作为标题"""
    try:
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == ".md":
            # 从Markdown文件中提取标题
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    # 寻找第一个标题行
                    if line.startswith('# '):
                        return line[2:].strip()
                    elif line.startswith('## '):
                        return line[3:].strip()
        
        elif ext == ".html":
            # 从HTML文件中提取标题
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                # 简单查找<title>标签
                start_tag = '<title>'
                end_tag = '</title>'
                start_pos = content.find(start_tag)
                if start_pos > -1:
                    end_pos = content.find(end_tag, start_pos)
                    if end_pos > -1:
                        return content[start_pos + len(start_tag):end_pos].strip()
                
                # 或者寻找第一个<h1>标签
                start_tag = '<h1>'
                end_tag = '</h1>'
                start_pos = content.find(start_tag)
                if start_pos > -1:
                    end_pos = content.find(end_tag, start_pos)
                    if end_pos > -1:
                        return content[start_pos + len(start_tag):end_pos].strip()
    
    except Exception as e:
        print(f"读取文件 {file_path} 失败: {e}")
    
    # 如果没有找到标题，使用文件名（去除扩展名）
    filename = os.path.basename(fallback_name)
    return os.path.splitext(filename)[0]

def normalize_paths(structure):
    """
    规范化路径，使用斜杠而不是反斜杠（Windows上的路径）
    """
    if "path" in structure:
        structure["path"] = structure["path"].replace("\\", "/")
    
    if "index" in structure and structure["index"]:
        structure["index"]["path"] = structure["index"]["path"].replace("\\", "/")
    
    if "children" in structure:
        for child in structure["children"]:
            normalize_paths(child)
    
    return structure

def load_existing_structure(filepath):
    """加载已存在的path.json文件结构"""
    try:
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"加载已有结构文件失败: {e}")
    return None

def merge_structures(existing, new_structure, config):
    """合并已有结构和新扫描的结构，保留已有结构的排序，添加新内容"""
    if not existing:
        return new_structure
    
    # 更新基本信息和索引文件
    # 保留原标题，但更新索引文件（如果有变化）
    result = existing.copy()
    
    # 如果新结构有索引但旧结构没有，或索引路径发生变化
    if (new_structure.get("index") and (not existing.get("index") or 
                                       existing.get("index", {}).get("path") != new_structure.get("index", {}).get("path"))):
        result["index"] = new_structure["index"]
    
    # 创建现有路径的映射，用于快速查找
    existing_paths = {}
    if "children" in existing:
        for child in existing["children"]:
            path = child.get("path", "")
            if path:
                existing_paths[path] = child
    
    # 创建新路径的映射，用于检查
    new_paths = {}
    if "children" in new_structure:
        for child in new_structure["children"]:
            path = child.get("path", "")
            if path:
                new_paths[path] = child
    
    # 保留现有子项
    updated_children = []
    for child in existing.get("children", []):
        path = child.get("path", "")
        if path in new_paths:
            # 如果是目录，递归合并
            if child.get("children") or new_paths[path].get("children"):
                updated_child = merge_structures(child, new_paths[path], config)
                updated_children.append(updated_child)
            else:
                # 文件项，保留原有结构（例如可能包含order字段）但更新标题
                child_copy = child.copy()
                child_copy["title"] = new_paths[path]["title"]
                updated_children.append(child_copy)
            # 标记为已处理
            del new_paths[path]
        else:
            # 检查这个路径是否真的不存在了
            full_path = os.path.join(config["root_dir"], path)
            if os.path.exists(full_path):
                # 如果文件或目录仍然存在，保留这个条目
                updated_children.append(child)
            else:
                print(f"移除不存在的项: {path}")
    
    # 添加新的子项（添加到末尾）
    for path, child in new_paths.items():
        updated_children.append(child)
    
    result["children"] = updated_children
    return result

def extract_content(file_path, max_chars=1000):
    """提取文件内容，用于搜索索引"""
    try:
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == ".md":
            # 从Markdown文件中提取内容
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
                # 移除Markdown标记
                # 移除代码块
                content = re.sub(r'```.*?```', '', content, flags=re.DOTALL)
                # 移除行内代码
                content = re.sub(r'`.*?`', '', content)
                # 移除链接，保留链接文本
                content = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', content)
                # 移除图片
                content = re.sub(r'!\[.*?\]\(.*?\)', '', content)
                # 移除HTML标签
                content = re.sub(r'<[^>]+>', '', content)
                # 移除标题标记
                content = re.sub(r'#+\s', '', content)
                # 移除空行和多余空格
                content = re.sub(r'\n+', ' ', content)
                content = re.sub(r'\s+', ' ', content)
                
                # 截取一部分内容
                return content[:max_chars]
        
        elif ext == ".html":
            # 从HTML文件中提取内容
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                parser = HTMLTextExtractor()
                parser.feed(content)
                text = parser.get_text()
                return text[:max_chars]
        
        return ""
    except Exception as e:
        print(f"读取文件 {file_path} 内容失败: {e}")
        return ""

def extract_keywords(content, max_keywords=10):
    """从内容中提取关键词"""
    if not content:
        return []
    
    # 定义停用词
    stopwords = set(['的', '了', '和', '是', '在', '我', '有', '个', '与', '这', '你', '们',
                     'the', 'and', 'is', 'in', 'to', 'of', 'a', 'for', 'on', 'that', 'by', 'this', 'with'])
    
    # 分词并统计频率
    words = re.findall(r'\b\w+\b|[\u4e00-\u9fa5]+', content.lower())
    word_freq = {}
    
    for word in words:
        if len(word) > 1 and word not in stopwords:
            word_freq[word] = word_freq.get(word, 0) + 1
    
    # 按频率排序并返回前N个关键词
    sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
    return [word for word, freq in sorted_words[:max_keywords]]

def build_search_tree(structure, config, result=None):
    """构建搜索树"""
    if result is None:
        result = []
    
    # 处理索引文档
    if structure.get("index"):
        file_path = os.path.join(config["root_dir"], structure["index"]["path"])
        if os.path.exists(file_path):
            content = extract_content(file_path)
            keywords = extract_keywords(content)
            
            search_item = {
                "title": structure["index"]["title"],
                "path": structure["index"]["path"],
                "content": content[:200] + "..." if len(content) > 200 else content,
                "keywords": keywords
            }
            result.append(search_item)
    
    # 处理文件
    for child in structure.get("children", []):
        if not child.get("children"):
            # 这是一个文件
            file_path = os.path.join(config["root_dir"], child["path"])
            if os.path.exists(file_path):
                content = extract_content(file_path)
                keywords = extract_keywords(content)
                
                search_item = {
                    "title": child["title"],
                    "path": child["path"],
                    "content": content[:200] + "..." if len(content) > 200 else content,
                    "keywords": keywords
                }
                result.append(search_item)
        else:
            # 这是一个目录，递归处理
            build_search_tree(child, config, result)
    
    return result

def main():
    parser = argparse.ArgumentParser(description='EasyDocument 文档路径生成工具')
    parser.add_argument('--root', default='data', help='文档根目录 (默认: data)')
    parser.add_argument('--output', default='path.json', help='输出文件 (默认: path.json)')
    parser.add_argument('--pretty', action='store_true', help='美化输出的JSON格式')
    parser.add_argument('--extend', action='store_true', help='拓展模式：保留已有结构和排序')
    parser.add_argument('--search', action='store_true', help='生成搜索索引文件(search.json)')
    parser.add_argument('--search-output', default='search.json', help='搜索索引输出文件 (默认: search.json)')
    
    # 检查是否没有提供参数
    if len(sys.argv) == 1:
        parser.print_help()
        print("\n风险提示:")
        print("------------------------")
        print("你正在尝试不带任何参数运行此工具，这将使用以下默认设置:")
        print(f" - 文档根目录: '{DEFAULT_CONFIG['root_dir']}'")
        print(f" - 输出文件: 'path.json'")
        print(f" - 不会使用拓展模式 (将覆盖任何已有的自定义排序和结构)")
        print(f" - 不会生成搜索索引")
        print("\n推荐的用法:")
        print("------------------------")
        print("标准使用: python build.py --pretty")
        print("保留结构: python build.py --extend --pretty")
        print("生成搜索索引: python build.py --extend --pretty --search")
        print("\n是否确定要继续使用默认设置? [y/N] ", end="")
        response = input().strip().lower()
        if response != 'y' and response != 'yes':
            print("操作已取消")
            return
        print("继续使用默认设置...")
    
    args = parser.parse_args()
    
    # 合并配置
    config = DEFAULT_CONFIG.copy()
    config["root_dir"] = args.root
    
    # 确保文档根目录存在
    if not os.path.isdir(config["root_dir"]):
        print(f"错误: 文档根目录 '{config['root_dir']}' 不存在!")
        return
    
    print(f"开始扫描目录: {config['root_dir']}")
    
    # 扫描文档目录并生成结构
    new_structure = scan_directory(config["root_dir"], config)
    new_structure = normalize_paths(new_structure)
    
    # 检查是否使用拓展模式
    if args.extend:
        existing_structure = load_existing_structure(args.output)
        if existing_structure:
            print(f"拓展模式: 合并已有结构 ({args.output})")
            final_structure = merge_structures(existing_structure, new_structure, config)
            
            # 确保最终结构规范化
            final_structure = normalize_paths(final_structure)
        else:
            print(f"未找到已有结构文件，将创建新文件")
            final_structure = new_structure
    else:
        final_structure = new_structure
    
    # 输出JSON文件
    indent = 4 if args.pretty else None
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(final_structure, f, ensure_ascii=False, indent=indent)
    
    print(f"已生成文档路径文件: {args.output}")
    
    # 生成搜索索引
    if args.search:
        print("开始构建搜索索引...")
        search_data = build_search_tree(final_structure, config)
        
        search_indent = 4 if args.pretty else None
        with open(args.search_output, 'w', encoding='utf-8') as f:
            json.dump(search_data, f, ensure_ascii=False, indent=search_indent)
        
        print(f"已生成搜索索引文件: {args.search_output} (共 {len(search_data)} 个文档)")
    
    # 打印基本统计信息
    file_count = count_files(final_structure)
    dir_count = count_dirs(final_structure)
    print(f"统计信息: {file_count} 个文档文件, {dir_count} 个目录")

def count_files(structure):
    """统计结构中的文件数量"""
    count = 0
    
    # 计算索引文件
    if "index" in structure and structure["index"]:
        count += 1
    
    # 计算子文件
    for child in structure["children"]:
        if "children" in child and len(child["children"]) == 0:
            # 这是一个文件
            count += 1
        else:
            # 这是一个目录，递归计算
            count += count_files(child)
    
    return count

def count_dirs(structure):
    """统计结构中的目录数量"""
    count = 0
    
    # 根目录算一个目录
    if structure["path"] == "":
        count = 1
    
    # 计算子目录
    for child in structure["children"]:
        if "children" in child and isinstance(child["children"], list):
            # 这是一个目录
            if child.get("path", ""):  # 排除根目录重复计算
                count += 1
            count += count_dirs(child)
    
    return count

if __name__ == "__main__":
    main() 