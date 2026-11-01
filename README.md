# gemini-lanhu

用于 Gemini CLI 的**蓝湖 (Lanhu) MCP 扩展**，专门为日常 **Qt/QML** 界面开发深度定制。

支持直接从蓝湖设计稿中：
- 🔍 **图层检索**：模糊搜索控件/文本/切片节点
- 📐 **几何标注**：自动累加多级父组嵌套，精准计算画板绝对坐标（`x`, `y`, `width`, `height`）
- 🎨 **QML 属性转换**：自动输出适合 QML 的色值（Hex `#RRGGBB` / `#AARRGGBB` / `Qt.rgba`）、圆角 `radius`、边框 `border`、像素字体 `font.pixelSize` 与字重枚举
- 🖼️ **切图批量下载**：一键将远端 OSS/CDN 的图标切片保存至当前 QML 项目目录（如 `assets/images/`）
- ⚡ **QML 组件草稿**：直接生成开箱即用的 `Rectangle` / `Text` / `Image` 代码片段

---

## 🛠️ 安装与启用

在 Gemini CLI 中直接通过命令本地安装该扩展：

```bash
gemini extensions install /home/gaolin/gemini-extensions/gemini-lanhu
```

或在扩展项目目录内执行：

```bash
gemini extensions install .
```

---

## 🔑 凭据配置

蓝湖需要已登录账号的 Web Cookie 来访问项目与设计稿元数据。

1. 打开浏览器登录 [lanhuapp.com](https://lanhuapp.com)
2. 按 `F12` 打开开发者工具，在 **Network (网络)** 标签页中找到任意对 `lanhuapp.com/api` 的请求
3. 复制该请求 Header 中的完整 `Cookie` 字段内容
4. 在 Gemini CLI 中使用工具或指令进行配置：
   - 方式一：直接在对话中告知 Agent：“把这个蓝湖 Cookie 设置一下：`<你的Cookie内容>`”（Agent 会自动调用 `lanhu_set_cookie` 保存到 `~/.gemini-lanhu.config.json`）。
   - 方式二：在操作系统中设置环境变量 `export LANHU_COOKIE="<你的Cookie内容>"`。

---

## 🚀 常用对话交互示例

- **查询设计稿信息**：
  > “请帮我分析一下这张蓝湖设计图：`https://lanhuapp.com/web/#/item/project/board/detail?pid=xxx&image_id=yyy`”
- **定位图层属性**：
  > “帮我找到设计图里的‘确定’按钮，告诉我它在画板上的绝对坐标、背景色、圆角和文字样式，并生成 QML 代码片段。”
- **导出切图**：
  > “列出这张设计图里所有的切图，并帮我把所有图标下载到当前工程的 `./assets/images` 目录下。”

---

## 🧰 提供的 MCP Tools

- `lanhu_set_cookie`: 设置/更新蓝湖登录 Cookie
- `lanhu_get_config`: 查看当前凭据与配置状态
- `lanhu_parse_url`: 解析蓝湖 Web 链接参数
- `lanhu_get_image_info`: 获取设计稿基础尺寸与图层统计
- `lanhu_list_layers`: 列出图层大纲树（支持限制展开深度）
- `lanhu_search_layers`: 模糊搜索图层
- `lanhu_get_element_properties`: 提取指定图层的样式属性与 QML 组件代码
- `lanhu_list_slices`: 查看可导出切图列表
- `lanhu_download_slices`: 批量或按名称下载切图至本地工程

---

## 🧪 开发与测试

```bash
# 运行单元测试
npm test

# 重新编译构建
npm run build
```
