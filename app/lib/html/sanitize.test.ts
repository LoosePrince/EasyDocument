import { describe, expect, it } from "vitest";
import { extractBody, sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("移除 script 标签及内容", () => {
    const out = sanitizeHtml("<p>安全</p><script>alert(1)</script>");
    expect(out).toContain("安全");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
  });

  it("移除事件处理器属性", () => {
    const out = sanitizeHtml('<img src="a.png" onerror="alert(1)" onclick=\'x()\'>');
    expect(out).toContain("a.png");
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("onclick");
  });

  it("移除 javascript: 协议链接", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).toContain("x");
    expect(out).not.toContain("javascript:");
  });

  it("移除 data: 协议", () => {
    const out = sanitizeHtml('<img src="data:text/html;base64,PHN2Zz4=">');
    expect(out).not.toContain("data:");
  });

  it("移除 iframe / object / embed / form", () => {
    const out = sanitizeHtml(
      '<iframe src="x"></iframe><object></object><embed src="x"><form></form><p>保留</p>',
    );
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("<object");
    expect(out).not.toContain("<embed");
    expect(out).not.toContain("<form");
    expect(out).toContain("保留");
  });

  it("移除 CSS expression()", () => {
    const out = sanitizeHtml('<div style="width:expression(alert(1))"></div>');
    expect(out).not.toContain("expression(");
  });

  it("保留正常 HTML 结构", () => {
    const out = sanitizeHtml('<section><h1>标题</h1><p class="x">正文</p></section>');
    expect(out).toContain("<h1>标题</h1>");
    expect(out).toContain('class="x"');
  });
});

describe("extractBody", () => {
  it("提取 body 内部", () => {
    expect(extractBody("<html><body><p>x</p></body></html>")).toBe("<p>x</p>");
  });

  it("无 body 时原样返回", () => {
    expect(extractBody("<p>x</p>")).toBe("<p>x</p>");
  });
});
