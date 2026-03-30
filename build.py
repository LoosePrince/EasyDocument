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
import datetime
from pathlib import Path
from html.parser import HTMLParser
import io
import zipfile
import shutil
import tempfile
import glob

# 默认配置
DEFAULT_CONFIG = {
    "root_dir": "data",                                 # 文档根目录
    "branch_support": False,                            # 是否启用分支支持
    "default_page": "README.md",                        # 默认文档
    "index_pages": ["README.md", "README.html",         # 索引页文件名
                   "index.md", "index.html"], 
    "supported_extensions": [".md", ".html"],           # 支持的文档扩展名
    "site": {
        "title": "",
        "description": "",
        "keywords": "",
        "base_url": ""
    },
    "appearance": {
        "favicon": "",
        "logo": "",
        "theme_color": ""
    }
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
            # 移除多余的换行符和空格
            cleaned_data = ' '.join(data.split())
            self.result.append(cleaned_data)

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
            file_path = os.path.join(directory, item)
            index_data = {
                "title": get_file_title(file_path, item) or "文档首页",
                "path": item_path,
            }
            
            result["index"] = index_data
            break
    
    # 处理其他文件
    for item in sorted(files):
        if not is_index_file(item, config):
            item_path = os.path.join(relative_path, item)
            file_path = os.path.join(directory, item)
            file_data = {
                "title": get_file_title(file_path, item),
                "path": item_path,
                "children": []
            }
            
            result["children"].append(file_data)
    
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

def strip_git_fields(structure):
    """
    移除结构中的 git 字段。
    Git 信息不再由 build.py 写入，改由前端基于 GitHub API 动态获取。
    """
    if isinstance(structure, dict):
        if "git" in structure:
            structure.pop("git", None)
        if "index" in structure and structure["index"]:
            strip_git_fields(structure["index"])
        if "children" in structure and isinstance(structure["children"], list):
            for child in structure["children"]:
                strip_git_fields(child)
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
        # 如果旧结构有索引且标题不为空，保留原有标题
        if existing.get("index") and existing["index"].get("title"):
            new_index = new_structure["index"].copy()
            new_index["title"] = existing["index"]["title"]  # 保留原有标题
            result["index"] = new_index
        else:
            result["index"] = new_structure["index"]
    # 索引文件没有变化时：保持既有内容（不再维护 git 信息字段）
    
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
                # 文件项，保留原有结构（例如可能包含order字段和手动设置的标题）
                child_copy = child.copy()
                # 保留原有标题，不从文件内容重新提取覆盖
                # child_copy["title"] = new_paths[path]["title"]  # 注释掉此行以保留手动设置的标题
                
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
    """主函数"""
    parser = argparse.ArgumentParser(description="EasyDocument 文档路径生成工具")
    parser.add_argument('--root', default=DEFAULT_CONFIG["root_dir"], help='文档根目录')
    parser.add_argument('--output', default='path.json', help='输出的JSON文件路径')
    parser.add_argument('--search-index', default='search.json', help='搜索索引文件路径')
    parser.add_argument('--merge', action='store_true', help='合并已有的JSON文件，保留顺序和自定义字段')
    parser.add_argument('--config', default='config.js', help='配置文件路径')
    parser.add_argument('--no-search', action='store_true', help='禁用搜索索引生成')
    parser.add_argument('-y', '--yes', action='store_true', help='自动确认所有提示，不询问')
    parser.add_argument('--package', action='store_true', help='创建更新包，打包指定文件为zip格式')
    parser.add_argument('--package-output', default='EasyDocument-update.zip', help='更新包输出路径')
    parser.add_argument('--initial-package', action='store_true', help='创建初始包，包含完整的项目文件')
    parser.add_argument('--initial-package-output', default='EasyDocument-initial.zip', help='初始包输出路径')
    parser.add_argument('--package-all', action='store_true', help='同时创建更新包和初始包')
    args = parser.parse_args()
    
    # 检查打包参数是否与其他操作参数共存
    if args.package or args.initial_package or args.package_all:
        package_args_count = 0
        if args.package:
            package_args_count += 1
        if args.initial_package:
            package_args_count += 1
        if args.package_all:
            package_args_count += 1
        
        if package_args_count > 1:
            print("错误: --package, --initial-package 和 --package-all 参数不能同时使用")
            sys.exit(1)
            
        # 检查是否使用了其他参数（除了包名称和--yes，它们可以与打包命令共存）
        other_args_used = False
        for arg_name, arg_value in vars(args).items():
            if arg_name not in ['package', 'package_output', 'initial_package', 'initial_package_output', 'package_all', 'yes'] and arg_value:
                if isinstance(arg_value, bool) and arg_value == True:
                    other_args_used = True
                    break
                elif not isinstance(arg_value, bool) and arg_value != parser.get_default(arg_name):
                    other_args_used = True
                    break
        
        if other_args_used:
            print("错误: 打包参数不能与其他操作参数共存")
            sys.exit(1)
            
        # 执行打包操作
        if args.package:
            create_update_package(args.package_output)
            return
        elif args.initial_package:
            create_initial_package(args.initial_package_output)
            return
        elif args.package_all:
            create_update_package(args.package_output)
            create_initial_package(args.initial_package_output)
            return
    
    # 检查是否有已存在的path.json文件且是否在没有使用任何参数的情况下运行
    if os.path.exists(args.output) and len(sys.argv) == 1:
        print("=" * 80)
        print("警告：检测到已存在的 path.json 文件！")
        print("=" * 80)
        print("如果不使用 --merge 参数重新生成，将可能会丢失以下信息：")
        print("  1. 文档的手动排序")
        print("  2. 自定义添加的属性或元数据")
        print("  3. 其他手动调整的结构")
        print("\n推荐使用以下命令:")
        print(f"  python {sys.argv[0]} --merge")
        print("\n完整的参数选项:")
        parser.print_help()
        print("\n" + "=" * 80)
        
        if not args.yes:
            response = input("\n是否仍要继续？这可能会重置您的文档结构。(y/n): ").strip().lower()
            if response != 'y' and response != 'yes':
                print("操作已取消。")
                sys.exit(0)
            else:
                print("\n继续执行，但不会合并现有结构...\n")
        else:
            print("\n自动确认模式：继续执行，但不会合并现有结构...\n")
    
    # 尝试从配置文件中提取配置
    config = DEFAULT_CONFIG.copy()
    if os.path.exists(args.config):
        try:
            with open(args.config, 'r', encoding='utf-8') as f:
                content = f.read()
                
                # 移除注释以简化解析
                content_no_comments = re.sub(r'//.*', '', content)
                content_no_comments = re.sub(r'/\*.*?\*/', '', content_no_comments, flags=re.DOTALL)

                # 提取 site 对象内容
                site_match = re.search(r'site:\s*{([^}]+)}', content_no_comments, re.DOTALL)
                if site_match:
                    site_config = site_match.group(1)
                    # 提取 site 内的具体字段
                    title_match = re.search(r'title:\s*["\'](.*?)["\']', site_config)
                    if title_match: config["site"]["title"] = title_match.group(1)
                    
                    desc_match = re.search(r'description:\s*["\'](.*?)["\']', site_config)
                    if desc_match: config["site"]["description"] = desc_match.group(1)
                    
                    keywords_match = re.search(r'keywords:\s*["\'](.*?)["\']', site_config)
                    if keywords_match: config["site"]["keywords"] = keywords_match.group(1)
                    
                    base_url_match = re.search(r'base_url:\s*["\'](.*?)["\']', site_config)
                    if base_url_match: config["site"]["base_url"] = base_url_match.group(1)

                # 提取 appearance 对象内容
                appearance_match = re.search(r'appearance:\s*{([^}]+)}', content_no_comments, re.DOTALL)
                if appearance_match:
                    appearance_config = appearance_match.group(1)
                    # 提取 appearance 内的具体字段
                    favicon_match = re.search(r'favicon:\s*["\'](.*?)["\']', appearance_config)
                    if favicon_match: config["appearance"]["favicon"] = favicon_match.group(1)
                    
                    # 添加 logo 和 theme_color 的提取
                    logo_match = re.search(r'logo:\s*["\'](.*?)["\']', appearance_config)
                    if logo_match: config["appearance"]["logo"] = logo_match.group(1)
                    
                    theme_color_match = re.search(r'theme_color:\s*["\'](.*?)["\']', appearance_config)
                    if theme_color_match: config["appearance"]["theme_color"] = theme_color_match.group(1)

                # 提取 document 对象内容 (主要为了 root_dir)
                document_match = re.search(r'document:\s*{([^}]+)}', content_no_comments, re.DOTALL)
                if document_match:
                    doc_config = document_match.group(1)
                    root_dir_match = re.search(r'root_dir:\s*[\'"]([^\'"]+)[\'"]', doc_config)
                    if root_dir_match:
                        config["root_dir"] = root_dir_match.group(1)
                    
                    branch_support_match = re.search(r'branch_support:\s*(true|false)', doc_config, re.IGNORECASE)
                    if branch_support_match:
                        config["branch_support"] = branch_support_match.group(1).lower() == 'true'
                
        except Exception as e:
            print(f"读取配置文件失败: {e}")
    
    # 命令行参数覆盖配置文件
    if args.root:
        config["root_dir"] = args.root
    
    root_dir = config["root_dir"]
    if not os.path.exists(root_dir):
        print(f"错误: 文档根目录 {root_dir} 不存在")
        sys.exit(1)
    
    # 确定要处理的目录列表
    branches_to_process = []
    if config.get("branch_support"):
        print(f"检测到分支支持已启用，扫描 {root_dir} 下的子目录...")
        for item in os.listdir(root_dir):
            item_path = os.path.join(root_dir, item)
            if os.path.isdir(item_path) and not item.startswith('.'):
                branches_to_process.append(item)
        if not branches_to_process:
            print(f"警告: 分支支持已启用，但在 {root_dir} 下未找到任何子目录")
    
    # 处理流程
    def process_dir(current_root, output_json, search_json):
        print(f"处理目录: {current_root}")
        # 扫描目录结构
        # 需要克隆配置并临时修改 root_dir 供 build_search_tree 使用
        local_config = config.copy()
        local_config["root_dir"] = current_root
        
        structure = scan_directory(current_root, local_config)
        
        # 规范化路径
        structure = normalize_paths(structure)

        # 移除遗留的 git 字段（即使 --merge 保留了旧字段，也会在最终输出时去除）
        structure = strip_git_fields(structure)
        
        # 如果需要合并已有结构
        if args.merge and os.path.exists(output_json):
            print(f"合并已有的JSON文件: {output_json}")
            existing = load_existing_structure(output_json)
            if existing:
                structure = merge_structures(existing, structure, local_config)
                # 合并后再次移除遗留 git 字段
                structure = strip_git_fields(structure)
        
        # 保存路径结构
        with open(output_json, 'w', encoding='utf-8') as f:
            json.dump(structure, f, ensure_ascii=False, indent=4)
        
        # 构建搜索索引
        if not args.no_search:
            print(f"构建搜索索引: {search_json}")
            search_tree = build_search_tree(structure, local_config)
            with open(search_json, 'w', encoding='utf-8') as f:
                json.dump(search_tree, f, ensure_ascii=False, indent=4)
        
        return structure

    # 根据是否启用分支支持来执行
    total_files = 0
    total_dirs = 0
    
    if branches_to_process:
        print(f"将为 {len(branches_to_process)} 个分支生成数据文件...")
        for branch in branches_to_process:
            branch_dir = os.path.join(root_dir, branch)
            branch_output = os.path.join(branch_dir, 'path.json')
            branch_search = os.path.join(branch_dir, 'search.json')
            
            structure = process_dir(branch_dir, branch_output, branch_search)
            total_files += count_files(structure)
            total_dirs += count_dirs(structure)
    else:
        # 单根目录模式
        structure = process_dir(root_dir, args.output, args.search_index)
        total_files = count_files(structure)
        total_dirs = count_dirs(structure)
    
    # 更新HTML元数据
    html_files_to_update = glob.glob('*.html')
    html_files_to_update.extend(glob.glob('main/*.html'))
    update_html_metadata(html_files_to_update, config)
    
    print(f"文档扫描完成: 共 {total_files} 个文件, {total_dirs} 个目录")

def count_files(structure):
    """计算结构中的文件总数"""
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
    """计算结构中的目录总数"""
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

def update_html_metadata(html_files, config):
    """
    根据 config.js 中的 site 和 appearance 设置更新 HTML 文件中的元数据。
    """
    site_config = config.get("site", {})
    appearance_config = config.get("appearance", {})

    title = site_config.get("title")
    description = site_config.get("description")
    keywords = site_config.get("keywords")
    favicon = appearance_config.get("favicon")

    for filepath in html_files:
        if not os.path.exists(filepath):
            print(f"警告: HTML文件未找到，跳过更新: {filepath}")
            continue

        try:
            with io.open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # 使用正则表达式进行替换
            if title:
                content = re.sub(r'(<title>)(.*?)(</title>)', r'\g<1>' + title + r'\g<3>', content, flags=re.IGNORECASE)
            if description:
                content = re.sub(r'(<meta\s+name=["\']description["\']\s+content=["\'])(.*?)(["\'])', r'\g<1>' + description + r'\g<3>', content, flags=re.IGNORECASE | re.DOTALL)
            if keywords:
                content = re.sub(r'(<meta\s+name=["\']keywords["\']\s+content=["\'])(.*?)(["\'])', r'\g<1>' + keywords + r'\g<3>', content, flags=re.IGNORECASE | re.DOTALL)
            if favicon:
                content = re.sub(r'(<link\s+rel=["\']icon["\']\s+href=["\'])(.*?)(["\'])', r'\g<1>' + favicon + r'\g<3>', content, flags=re.IGNORECASE | re.DOTALL)

            with io.open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"已更新元数据: {filepath}")

        except Exception as e:
            print(f"更新HTML文件 {filepath} 时出错: {e}")

def create_update_package(output_file='EasyDocument-update.zip'):
    """
    创建更新包，包含指定的文件和目录，用于覆盖更新旧项目的代码
    
    打包内容包括：
    - assets 文件夹
    - main 文件夹（文档页入口等）
    - config.js（在压缩包中改名为 default.config.js）
    - 根目录 HTML：index.html, 404.html, header.html, footer.html
    - meta.json, requirements.txt, build.py
    """
    print(f"开始创建更新包: {output_file}")
    
    # 创建临时目录存放待打包文件
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"创建临时目录: {temp_dir}")
        
        # 复制assets文件夹
        assets_path = 'assets'
        if os.path.exists(assets_path) and os.path.isdir(assets_path):
            assets_temp_path = os.path.join(temp_dir, 'assets')
            shutil.copytree(assets_path, assets_temp_path)
            print(f"已复制: {assets_path}")
        else:
            print(f"警告: {assets_path} 目录不存在，将被跳过")
        
        # 复制config.js并改名为default.config.js
        config_path = 'config.js'
        if os.path.exists(config_path):
            default_config_path = os.path.join(temp_dir, 'default.config.js')
            shutil.copy2(config_path, default_config_path)
            print(f"已复制并重命名: {config_path} -> default.config.js")
        else:
            print(f"警告: {config_path} 文件不存在，将被跳过")
        
        # 复制main目录
        main_path = 'main'
        if os.path.exists(main_path) and os.path.isdir(main_path):
            main_temp_path = os.path.join(temp_dir, 'main')
            shutil.copytree(main_path, main_temp_path)
            print(f"已复制: {main_path}")
        else:
            print(f"警告: {main_path} 目录不存在，将被跳过")
        
        # 复制根目录下的 HTML 文件（入口、布局、错误页等）
        root_html_files = ['index.html', '404.html', 'header.html', 'footer.html']
        for html_file in root_html_files:
            if os.path.exists(html_file):
                html_temp_path = os.path.join(temp_dir, html_file)
                shutil.copy2(html_file, html_temp_path)
                print(f"已复制: {html_file}")
            else:
                print(f"警告: {html_file} 文件不存在，将被跳过")
        
        # 复制其他文件
        other_files = ['meta.json', 'requirements.txt','build.py']
        for file in other_files:
            if os.path.exists(file):
                file_temp_path = os.path.join(temp_dir, file)
                shutil.copy2(file, file_temp_path)
                print(f"已复制: {file}")
            else:
                print(f"警告: {file} 文件不存在，将被跳过")
        
        # 创建ZIP文件
        with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # 遍历临时目录中的所有文件和子目录
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    # 计算相对于临时目录的路径，作为zip内的路径
                    arc_path = os.path.relpath(file_path, temp_dir)
                    zipf.write(file_path, arc_path)
        
        print(f"更新包创建完成: {output_file}")
        # 显示ZIP文件大小
        zip_size = os.path.getsize(output_file)
        print(f"更新包大小: {zip_size / 1024:.2f} KB")

def create_initial_package(output_file='EasyDocument-initial.zip'):
    """
    创建初始包，包含完整的项目文件
    
    打包内容包括：
    - assets 文件夹
    - main 文件夹（文档页入口等）
    - data/README.md 空文件（自动创建）
    - config.js（不改名）
    - 根目录下所有 .html 文件
    - LICENSE, README.md, build.py, meta.json, requirements.txt
    """
    print(f"开始创建初始包: {output_file}")
    
    # 创建临时目录存放待打包文件
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"创建临时目录: {temp_dir}")
        
        # 复制assets文件夹
        assets_path = 'assets'
        if os.path.exists(assets_path) and os.path.isdir(assets_path):
            assets_temp_path = os.path.join(temp_dir, 'assets')
            shutil.copytree(assets_path, assets_temp_path)
            print(f"已复制: {assets_path}")
        else:
            print(f"警告: {assets_path} 目录不存在，将被跳过")
        
        # 创建data目录和README.md空文件
        data_dir = os.path.join(temp_dir, 'data')
        os.makedirs(data_dir, exist_ok=True)
        data_readme = os.path.join(data_dir, 'README.md')
        with open(data_readme, 'w', encoding='utf-8') as f:
            f.write('# EasyDocument\n\n这是您的文档目录，请在此处添加Markdown或HTML文档。')
        print(f"已创建: data/README.md")
        
        # 复制config.js (不改名)
        config_path = 'config.js'
        if os.path.exists(config_path):
            config_temp_path = os.path.join(temp_dir, 'config.js')
            shutil.copy2(config_path, config_temp_path)
            print(f"已复制: {config_path}")
        else:
            print(f"警告: {config_path} 文件不存在，将被跳过")
        
        # 复制main目录
        main_path = 'main'
        if os.path.exists(main_path) and os.path.isdir(main_path):
            main_temp_path = os.path.join(temp_dir, 'main')
            shutil.copytree(main_path, main_temp_path)
            print(f"已复制: {main_path}")
        else:
            print(f"警告: {main_path} 目录不存在，将被跳过")
        
        # 复制根目录下的 HTML 文件
        html_files = glob.glob('*.html')
        for html_file in html_files:
            if os.path.exists(html_file):
                html_temp_path = os.path.join(temp_dir, html_file)
                shutil.copy2(html_file, html_temp_path)
                print(f"已复制: {html_file}")
            else:
                print(f"警告: {html_file} 文件不存在，将被跳过")
        
        # 复制其他文件
        other_files = ['LICENSE', 'README.md', 'build.py', 'meta.json', 'requirements.txt']
        for file in other_files:
            if os.path.exists(file):
                file_temp_path = os.path.join(temp_dir, file)
                shutil.copy2(file, file_temp_path)
                print(f"已复制: {file}")
            else:
                print(f"警告: {file} 文件不存在，将被跳过")
        
        # 创建ZIP文件
        with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # 遍历临时目录中的所有文件和子目录
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    # 计算相对于临时目录的路径，作为zip内的路径
                    arc_path = os.path.relpath(file_path, temp_dir)
                    zipf.write(file_path, arc_path)
        
        print(f"初始包创建完成: {output_file}")
        # 显示ZIP文件大小
        zip_size = os.path.getsize(output_file)
        print(f"初始包大小: {zip_size / 1024:.2f} KB")

if __name__ == "__main__":
    main() 