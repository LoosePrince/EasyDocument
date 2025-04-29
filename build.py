#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
EasyDocument 文档路径生成工具
用于扫描data目录下的所有文档文件，并生成path.json文件
"""

import os
import json
import argparse
from pathlib import Path

# 默认配置
DEFAULT_CONFIG = {
    "root_dir": "data",                                 # 文档根目录
    "default_page": "README.md",                        # 默认文档
    "index_pages": ["README.md", "README.html",         # 索引页文件名
                   "index.md", "index.html"], 
    "supported_extensions": [".md", ".html"],           # 支持的文档扩展名
}

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

def main():
    parser = argparse.ArgumentParser(description='EasyDocument 文档路径生成工具')
    parser.add_argument('--root', default='data', help='文档根目录 (默认: data)')
    parser.add_argument('--output', default='path.json', help='输出文件 (默认: path.json)')
    parser.add_argument('--pretty', action='store_true', help='美化输出的JSON格式')
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
    structure = scan_directory(config["root_dir"], config)
    structure = normalize_paths(structure)
    
    # 输出JSON文件
    indent = 2 if args.pretty else None
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(structure, f, ensure_ascii=False, indent=indent)
    
    print(f"已生成文档路径文件: {args.output}")
    
    # 打印基本统计信息
    file_count = count_files(structure)
    dir_count = count_dirs(structure)
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