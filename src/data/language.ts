const portfolioDemo = import.meta.env.MODE === 'portfolio'

export type Language = 'en' | 'zh'
const remembered = (() => {
  try { return localStorage.getItem('motif-language') } catch { return null }
})()
export const language: Language = remembered === 'en' || remembered === 'zh' ? remembered : portfolioDemo ? 'en' : 'zh'
export const isEnglish = language === 'en'
document.documentElement.lang = isEnglish ? 'en' : 'zh-CN'

export function changeLanguage() {
  localStorage.setItem('motif-language', isEnglish ? 'zh' : 'en')
  location.reload()
}

const english = new Map(
  `对话|Conversation
档案室|Archive
项目星云|Project Atlas
视觉板|Vision Board
即时灵感|Quick Notes
待办清单|To-do List
打开设置|Open settings
设置|Settings
文稿|Documents
图片|Images
视频|Video
数据|Data
图片与视频|Images and video
预案|Plan
项目创作进度|Project workflow
确认预案，生成文稿|Approve plan and draft
确认文稿，寻找图片与视频|Approve draft and find media
修改预案|Revise plan
修改文稿|Revise draft
全部收入项目|Save all to project
已全部入档|All saved
收入项目|Save to project
已入档|Saved
去档案室整理|Organize in Archive
来源|Source
联网图片与视频结果|Media search results
电视剧官方剧照|Official series stills
图片与视频检索词|Search terms for media
输入素材检索词…|Enter a media search term…
重新检索|Search again
仅供研究参考|Research reference
授权与署名以来源页为准|See the source for credits and terms
结果来自开放媒体库，不是模型生成的图片。|Results come from an open media library.
没有找到匹配的图片或视频。可以缩短检索词，或改用作品中英文名、作者名重新检索。|No matching media. Try a title, creator or shorter search term.
图片来自 Marvel 官方剧集页面，不是开放授权素材。|Stills link to Marvel's official series page.
未命名文稿|Untitled draft
文稿编辑器 · 自动保存|Document Editor · Autosave
编辑项目文稿|Edit project document
文稿标题|Document title
关闭文稿编辑器|Close document editor
文稿标签|Document tags
主题标签，用逗号分隔|Tags, separated by commas
文稿已导出为 Markdown。|Draft exported as Markdown.
删除这份文稿及其项目引用？|Delete this document and its project links?
编辑|Edit
预览|Preview
导出|Export
删除|Delete
在这里继续写作…|Continue writing here…
文稿正文|Document body
字符 · 自动保存|characters · Autosaved
对话和档案室共享这份文稿|Shared across Conversation and Archive
工作台悬浮导航|Workbench navigation
返回房间首页|Return to the room
正在导入真实素材…|Loading project materials…
打开《从弗兰肯斯坦到幻视》|Open From Frankenstein to Vision
导入《从弗兰肯斯坦到幻视》|Import From Frankenstein to Vision
从弗兰肯斯坦到幻视|From Frankenstein to Vision
当造物有了感情，人类该如何回应？|When Our Creations Feel, How Should We Respond?
工作区|workspace
收起浮层|Close panel
已完成|Completed
新建并关联项目|Create and link project
关闭新建项目|Close new project
新建项目文件夹|New project folder
项目名称|Project name
例如：人造生命与数字亲密|e.g. Artificial life and digital intimacy
项目说明|Project brief
目标、问题或下一步…|Goal, research question or next step…
领域|Fields
文学，影像，人机传播|Literature, film, human–computer communication
创建并关联对话|Create and link conversation
创建文件夹|Create folder
关闭新建任务|Close new task
新建任务|New task
任务内容|Task details
写下一个可以执行的动作…|Write an actionable next step…
归入项目|Assign to project
独立待办，不归入项目|Personal task, no project
创建任务|Create task
新任务|New task
任务名称|Task name
添加一项任务…|Add a task…
修改任务…|Edit task…
添加任务|Add task
保存任务|Save task
所属项目|Project
独立任务|Personal task
截止日期|Due date
取消编辑|Cancel edit
按任务状态筛选|Filter by status
全部|All
未完成|Open
任务已删除|Task deleted
撤销删除任务|Undo task deletion
项目|Project
已逾期 · |Overdue · 
截止 · |Due · 
编辑任务：|Edit task: 
删除任务：|Delete task: 
当前筛选下没有任务。|No tasks match this filter.
还没有任务，在上方添加第一项。|Add your first task above.
研究项目已入档：3 张图片、1 部完整短片和 3 份研究资料。|Project loaded with three images, one film and three research notes.
导入失败，请重试。|Import failed. Try again.
任务已加入项目。|Task added to project.
独立任务已加入待办清单。|Personal task added to your list.
文稿已保存到档案室。|Draft saved to Archive.
素材已保存到档案室。|Media saved to Archive.
文学|Literature
电影|Film
人造生命|Artificial life
可360度拖动环绕的三维房间|Interactive 360° room
360° 拖动环绕 · 滚轮靠近 · 点击物件|Drag to orbit · Scroll to zoom · Click objects
房间叙事章节|Room chapters
浪漫主义的纸上房间|The illustrated room
伍尔夫时期的房间|Woolf’s writing room
由你重新书写的房间|A room for your own work
点亮台灯，让插画获得重量。|Turn on the lamp to bring the room to life.
光已经进来。去书柜，取出那本书。|The light is on. Go to the bookcase.
现在，房间属于你。点击书桌，开始书写。|The room is yours. Click the desk to start writing.
一个故事，正在变成你的实践。|Your story is taking shape.
关闭物件注释|Close object note
光扫过纸面，插画里的物件开始拥有重量。|Light moves across the page and the objects take shape.
灯熄灭了，房间还保留着已经获得的质感。|The lamp is off. The room retains its textures.
抽出《一间自己的房间》。繁复的装饰退去，独立书写的空间逐渐清晰。|Pull out A Room of One’s Own and discover a space for writing.
窗已推开。花园沿着窗台生长，远处山丘与天空也终于清晰可见。|The window opens and flowers spread along the sill and into the garden.
窗合上了，花园仍在窗外，房间重新安静。|The window closes and the room grows quiet.
柜门后收藏着陶瓷、珠光、缎带与尚未成形的 Vision Board。|Inside are ceramics, pearls, ribbons and the beginnings of a vision board.
再点一次衣柜，看看古典房间里收藏的新材质。|Click the wardrobe again to see its materials.
翻开的工作日记|Open work journal
合上日记|Close journal
打开我的工作台|Open my workbench
对话、素材、文稿，|Conversations, assets, drafts,
以及每一张视觉板。|and every vision board.
点击纸页，进入工作台|Click the page to enter the workbench
可拖动环顾、点击物件的三维文学房间|A 3D literary room. Drag to look around and click objects.
当前浏览器未能启动三维场景，仍可直接进入工作台。|This browser could not start the 3D room. You can still enter the workbench.
部分房间纹理未能载入，物件交互仍可使用。|Some room textures failed to load. Objects remain interactive.
工作台功能|Workbench features
正在打开 MOTIF|Opening MOTIF
找不到|Could not find 
01 / 探索 3D 房间|01 / Explore the 3D Room
01 / 3D 房间 · |01 / 3D Room · 
01 / 3D 房间 · 镜头靠近窗户|01 / 3D Room · Approach the window
01 / 3D 房间 · 点开桌上的笔记本|01 / 3D Room · Open the notebook
点亮台灯|Turn on the lamp
从书架抽出伍尔夫的书|Take Woolf’s book from the shelf
打开衣柜，查看收藏|Open the wardrobe and view the collection
开窗 · 花从窗台向外绽放|Open the window and watch the flowers bloom
01 / 3D 房间 · 拉远，看看开满花的庭院|01 / 3D Room · Pull back to reveal the garden
01 / 3D 房间 · 360° 环绕全景 · 也可以拖动探索|01 / 3D Room · 360° orbit · Drag to explore
拉近书桌，看看桌上的笔记本|Move in toward the notebook
01 / 3D 房间 · 从笔记本进入工作台|01 / 3D Room · Enter the workbench from the notebook
02 / 模拟填写 API 配置|02 / Simulated API setup
03 / 当造物有了感情，人类该如何回应？|03 / When Our Creations Feel, How Should We Respond?
04 / 预览素材并收入项目|04 / Preview media and save to the project
05 / 对照两代《弗兰肯斯坦》与幻视的影像|05 / Compare Frankenstein and Vision on screen
05 / 档案室 · |05 / Archive · 
06 / 在档案室拖放文稿|06 / Organize a document in the archive
07 / 记下灵感并添加待办|07 / Capture a note and add a task
## 补充记录|## Field note
关键词：造物责任 · 自主选择 · 归属|Keywords: creator responsibility, agency, belonging
整理弗兰肯斯坦与幻视的对照表|Build the Frankenstein and Vision comparison table
演示完成 · 现在可以自己操作|Walkthrough complete · Explore at your own pace
自动演示已停止 · 可以继续手动试玩|Walkthrough stopped · Continue exploring manually
自动演示|Guided walkthrough
MOTIF · 项目演示|MOTIF · Guided case study
图文版|Illustrated guide
手动试玩|Manual mode
接管操作|Take control
重播|Replay
填入研究问题|Use the research prompt
发送消息|Send message
我要做一个研究项目|Plan a research project
我要策划一支短片|Plan a short film
我要做一张视觉板|Create a vision board
告诉我你想做什么。我们会按“预案 → 文稿 → 图片与视频”一步步完成，每一步都由你确认。|Tell me what you want to make. We’ll plan, draft and gather media, with your approval at each step.
新对话|New conversation
模型请求失败，请检查接口配置。|The model request failed. Check your connection settings.
正在重新检索开放媒体库…|Searching the media library again…
这次没有找到匹配的开放媒体。可以修改检索词后再找，不会自动收入任何文件。|No matching media. Change the search terms and try again.
确认预案。请根据以上预案生成文稿。|I approve the plan. Please write the draft.
确认文稿。请继续寻找图片和视频。|I approve the draft. Please find images and video.
正在从开放媒体库寻找图片和视频…|Searching the open media library…
对话列表|Conversations
新建对话|New conversation
独立对话|Personal conversation
删除对话|Delete conversation
删除对话，保留项目文件|Delete this conversation
对话与项目各自保留。删除对话不会删除任何文件。|Project files remain available after you delete a conversation.
Agent 对话|Agent Conversation
未连接模型|Model disconnected
等待响应|Waiting for response
正在联网检索|Searching online
正在输出|Writing a response
请求失败|Request failed
就绪|Ready
当前对话关联项目|Project linked to this conversation
未命名项目|Untitled project
新建|New
新建项目|New project
并关联到当前对话|Link to this conversation
加入独立待办|Add to personal tasks
收起当前项目文件|Collapse project files
展开当前项目文件|Expand project files
当前项目文件|Current project files
独立对话 · 需要时再关联项目|Personal conversation · Link a project anytime
在档案室查看|View in Archive
快捷任务|Quick prompts
本次联网检索词|Search queries
检索|Search
网页来源|Web sources
已保存|Saved
存入项目|Save to project
存入档案|Save to archive
未添加主题标签|No tags
点击编辑文稿 · 自动保存|Edit document · Autosaved
请修改预案：|Revise the plan: 
请修改文稿：|Revise the draft: 
转为任务|Turn into a task
编辑文稿|Edit document
存为文稿|Save as document
检查配置|Check settings
正在连接模型|Connecting to model
作品集试玩 · 示例流式回复|Portfolio demo · Sample streaming responses
给 Agent 写下任务|Write a prompt for the agent
写下新项目，或告诉 Agent 如何修改当前步骤…|Start a project or ask the agent to revise this step…
连接模型后，从项目预案开始…|Connect a model to start planning…
只向模型提供当前项目资料|Use only the current project’s materials
向模型提供全部档案索引|Use the full archive index
关联项目后可限定资料范围|Link a project to limit the material scope
项目资料|Project context
添加素材|Attach materials
新建文稿|New document
Enter 发送 · Shift + Enter 换行|Enter to send · Shift + Enter for a new line
停止生成|Stop generating
停止|Stop
收起项目文件|Collapse project files
引用同一份档案，不创建副本|Files are shared with the archive.
文稿与成果|Documents and outputs
在当前项目新建文稿|New document in this project
字符 · 点击编辑|characters · Click to edit
对话回复可存为文稿，也可以新建空白文稿。|Save a reply as a document or start a blank draft.
项目素材|Project materials
在档案室整理当前项目素材|Organize these materials in Archive
在档案室把图片、视频或数据拖入此项目。|Drag images, video or data into this project from Archive.
整理项目文件|Organize project files
这段对话还未关联项目|No linked project
关联后，对话成果和项目文件会在右侧汇合；不关联也能正常使用。|Link a project to see its materials and conversation outputs here.
打开|Open
最近使用|Recent
全部文件|All files
文件类型文件夹|File type filters
全部类型|All types
搜索当前文件|Search current files
搜索文件名或标签|Search filenames or tags
清空搜索|Clear search
取消全选|Deselect all
全选|Select all
混合文件|Mixed files
近 30 天文件|Files from the last 30 days
全部项目与未归档文件|All projects and unfiled materials
拖到右侧项目文件夹完成整理|Drag files into a project folder on the right
我的素材|My materials
示例素材|Sample materials
保留原文件与本地下载。|Original file available to download.
标签|Tags
下载|Download
下载失败|Download failed
没有匹配的文件|No matching files
这个项目还没有此类文件|No files of this type in this project
近期没有使用文件|No recent files
档案室还是空的|The archive is empty
试试其他关键词，或切换文件类型。|Try another keyword or file type.
上传文件，或从其他项目拖入文件。|Upload files or drag them in from another project.
项目文件夹|Project folders
项目与类型可组合筛选|Filter by project and file type together
上传|Upload
完整档案室|Full archive
近 30 天|Last 30 days
全部项目|All projects
新建文件夹|New folder
创建项目并收纳文件|Create a project to organize files
项目可混装图片、视频、文稿和数据；切换项目不会清除类型筛选。|Project folders can hold any file type.
返回档案室|Return to Archive
取消删除|Cancel deletion
选择移除范围|Choose what to remove
仅从当前项目移除|Remove from this project
文件仍保留在整个档案室|Keep the file in Archive
从整个档案室删除|Delete from Archive
同时移除所有项目引用|Remove every project link
关闭标签编辑|Close tag editor
主题标签|Tags
用逗号分隔多个标签|Separate tags with commas
例如：人造生命，影像，亲密|e.g. Artificial life, film, intimacy
标签完全由你填写，不会自动生成，可用于检索和项目星云。|Your tags support filtering and the Project Atlas.
取消|Cancel
保存标签|Save tags
主题标签已手动更新。|Tags updated.
灵感|Ideas
研究|Research
文字|Writing
图像|Images
写下灵感|Write a note
编辑灵感|Edit note
写下一句话、一个画面，或还没有答案的问题…|Capture a sentence, an image or an open question…
分类|Category
添加便签|Add note
保存便签|Save note
拖动便签整理位置；聚焦后可用方向键移动。内容保存在当前浏览器。|Drag a note or move it with the arrow keys. Notes are saved in this browser.
可整理的玻璃便利贴墙|Organizable note wall
搜索灵感|Search notes
搜索灵感…|Search notes…
切换到便签墙|Show wall
切换到列表|Show list
便签已删除|Note deleted
撤销删除便签|Undo note deletion
按分类筛选便签|Filter notes by category
删除便签：|Delete note: 
编辑便签：|Edit note: 
转为待办：|Make task: 
转为待办|Make task
修改便签分类|Change note category
没有找到匹配的灵感。|No matching notes.
这个分类还没有便签。|No notes in this category.
灵感已更新。|Note updated.
新的玻璃便签已放上灵感墙，可以拖动或重新分类。|Note added. You can move or reclassify it.
已加入待办清单，原便签已保留。|Added to your to-do list. The note is still available.
显示、动效与模型连接。|Display, motion and model connection.
显示与动效|Display and Motion
显示藏品标注|Show material labels
素材主题标签与画板图片题名|Tags and titles on artwork
减少动态|Reduce motion
减少页面过渡与动态反馈|Limit transitions and animated feedback
模型接口|Model connection
模型名|Model name
例如 kimi-k3.1-pro|e.g. gpt-4.1-mini
仅保留在当前页面内存|Stored in this page session
保存配置|Save settings
清除密钥|Clear key
请输入有效的 HTTP(S) Base URL 或完整 chat/completions 地址。|Enter a valid HTTP(S) base URL or chat completions endpoint.
接口配置已保留在当前页面，可在对话中验证真实响应。|Settings saved for this session.
接口地址与模型名已保存；未填写密钥，项目创作流程暂不可用。|Endpoint and model saved. Enter an API key to use live responses.
API Key 已清除，项目创作流程已暂停。|API key cleared. Live responses are paused.
请通过 npm run dev 或 npm run preview 启动。模型请求由本地服务转发，API Key 仅保留在页面内存，刷新后需重新输入。模型调用可能产生费用；图片与视频检索使用 Wikimedia Commons 开放接口，无需 API Key，文件授权以来源页为准。|The local server forwards model requests. Your key stays in memory for this session. Live requests may incur costs.
《弗兰肯斯坦》（2025）· 造物剧照|Frankenstein (2025) · The Creature
德尔·托罗版 · Ken Woroner / Netflix|Guillermo del Toro’s film · Ken Woroner / Netflix
VisionQuest 剧照 · 幻视|VisionQuest · Vision still
2026 新剧 · Disney+|2026 series · Disney+
VisionQuest 官方海报|VisionQuest official poster
《旺达幻视》剧照|WandaVision still
剧照 · Marvel Studios / Inverse|Still · Marvel Studios / Inverse
《旺达幻视》官方海报|WandaVision official poster
海报 · Disney+|Poster · Disney+
《Vision》2015 年第 1 期封面|Vision (2015) #1 cover
漫画 · Marvel|Comic · Marvel
《弗兰肯斯坦》（2025）最终预告|Frankenstein (2025) final trailer
Netflix 官方视频|Official Netflix video
VisionQuest 官方正式预告|VisionQuest official trailer
2026 新剧 · Marvel|2026 series · Marvel
《旺达幻视》官方预告|WandaVision official trailer
2021 剧集 · Disney+|2021 series · Disney+
播放|Play 
· 在 YouTube 打开|· Open on YouTube
弗兰肯斯坦与幻视 · 影像资料|Frankenstein & Vision · Screen References
从漫画与《旺达幻视》，追到 2026 年新剧《VisionQuest》。比较幻视如何面对创造者留下的用途。|Trace Vision from comics and WandaVision to VisionQuest, and compare how he responds to his intended purpose.
VisionQuest 官方制作资料 PDF|VisionQuest official production notes (PDF)
幻视研究任务与资料.md|Vision Research Brief.md
人造物情感研究提纲.md|Research Outline — Emotion and Agency.md
来源索引｜从弗兰肯斯坦到幻视.md|From Frankenstein to Vision — Sources.md
1831 年卷首插画.jpg|1831 Frontispiece.jpg
1910 年电影海报.jpg|1910 Film Poster.jpg
1910 年电影剧照.jpg|1910 Film Still.jpg
1910 年《弗兰肯斯坦》完整短片.mp4|Frankenstein (1910) — Full Short Film.mp4
公版标记见来源页|See source for public-domain status
公版标记及适用地区见来源页|See source for public-domain status and jurisdiction
造物与自主性|Creation and agency
哥特式门廊|Gothic Doorway
古典拱廊|Classical Arcade
装饰茶壶|Decorative Teapot
收集|Collect
创作|Create
完成|Complete
待办|To do
进行中|In progress
项文件|files
编辑任务：|Edit task: 
已逾期 ·|Overdue ·
截止 ·|Due ·
字符|characters
建筑|Architecture
版画|Print
绘画|Painting
器物|Object
陶瓷|Ceramics
API Key 已从当前页面内存清除，项目创作流程已暂停。|API key cleared. Live responses are paused.
项目文件夹已删除，文件、文稿与对话仍保留。|Project folder deleted. Files, drafts and conversations remain available.
从一个真实项目开始。|Start with a project.
任务、素材、文稿和 Agent 对话会在这里汇合。|Tasks, materials, documents and conversations are grouped here.
项目领域，用逗号分隔|Project fields, separated by commas
添加领域，用逗号分隔|Add fields, separated by commas
项目阶段|Project stage
导出项目索引|Export project index
删除项目|Delete project
记录目标、下一步或当前问题…|Record the goal, a next step or an open question…
任务完成|Tasks completed
可拖动的项目任务画布|Draggable project task canvas
任务画布|Task canvas
更改任务状态|Change task status
删除任务|Delete task
素材库|Archive
选择要加入项目的素材|Select a file for the project
选择素材…|Choose a file…
加入项目|Add to project
从项目移除|Remove from project
移出项目|Remove from project
从素材库加入图片、视频、文稿或数据，不复制原文件。|Link images, videos, documents and data from Archive.
新建文稿后会自动归入当前项目，可编辑并导出 Markdown。|New drafts go in this project and can be edited or exported as Markdown.
让工作有一个可见的容器|Create a project workspace
新建项目后，可拖动任务、引用素材、写文稿，并继续 Agent 对话。|Create a project to organize tasks, materials, drafts and conversations.
新建第一个项目|Create your first project
任务|Tasks
尚未填写项目说明。|No project brief yet.
未设置|Not set
无标签|No tags
## 任务|## Tasks
## 素材引用|## Linked materials
## 文稿|## Documents
- 暂无|- None yet
我的项目星系|My Project Atlas
项目 · 领域 · 知识标签|Projects · Fields · Tags
项目领域|Project fields
知识标签|Knowledge tags
项目星云显示模式|Project Atlas view mode
星云|3D Atlas
架构图|Map
还没有项目节点|No project nodes yet
新建项目并添加领域；项目内素材与文稿的手动标签会形成知识连接。|Create a project and add fields. Tags on its materials and drafts form connections.
新建或管理项目|Create or manage projects
可旋转缩放的三维项目星云|Interactive 3D Project Atlas
项目、领域与知识标签平面架构图|Map of projects, fields and knowledge tags
放大星云|Zoom in
缩小星云|Zoom out
重置星云视角|Reset atlas view
拖拽旋转 · 滚轮缩放 · 点击节点|Drag to orbit · Scroll to zoom · Click a node
跨项目连接|Cross-project links
领域与知识标签|Fields and knowledge tags
这是在项目中手动填写的领域，不是模型推断。|Fields are defined in the project settings.
来自项目内素材与文稿的手动主题标签。|Tags come from project materials and drafts.
管理项目|Manage projects
只呈现真实项目、手动领域和项目内已有的标签，不推断创作母题或思维局限。|The atlas displays your projects, fields and existing tags.
方向键旋转 · + / − 缩放 · 0 复位|Arrow keys to orbit · + / − to zoom · 0 to reset
点击项目、领域或标签查看直接关联|Select a project, field or tag to see its direct connections
尚未添加领域或项目内标签|No fields or project tags yet
领域来自项目设置；知识标签只统计项目已引用的素材与文稿。|Fields come from project settings. Tags come from linked materials and drafts.
画板布局|Board layout
自由布局|Free layout
网格布局|Grid layout
重排|Rearrange
正在导出|Exporting
导出 PNG|Export PNG
可拖动编辑并导出的 Vision Board|Editable and exportable vision board
画板素材|Board materials
可拖动或使用方向键移动|Drag or move with the arrow keys
当前为网格布局|Grid layout active
画板图片|Board image
原图已移除|Original image removed
请在右侧删除此物件|Remove this item from the right sidebar
从右侧添加图片或文字。|Add an image or text from the right sidebar.
添加|Add
先在素材库上传图片。|Upload an image in Archive first.
添加文字|Add text
视频和文档请留在素材库中整理。|Manage video and documents in Archive.
选中物件|Selected item
左转|Rotate left
右转|Rotate right
缩小|Scale down
放大|Scale up
置顶|Bring to front
移除|Remove
选中画板上的图像或文字，即可调整。|Select an image or text to adjust it.
拖动或使用方向键调整位置。构图自动保存；移除物件不会删除素材原图。|Drag or use the arrow keys to position items. Your arrangement saves automatically.
画板已重新排布，可以继续拖动调整。|Board rearranged.
当前构图已按位置、尺寸、旋转和层级导出为 PNG。|Board exported as PNG.
未命名素材|Untitled material
画板还是空的，先放入图片或文字吧。|Add an image or text before exporting.
当前浏览器无法创建 PNG 画布。|This browser could not create a PNG canvas.
PNG 导出失败，请重试。|PNG export failed. Try again.
没有可导入的文件。|No supported files to import.
文件读取失败，请重试。|Could not read the file. Try again.
导出失败，请重试。|Export failed. Try again.
先留下几个字，再让灵感落到桌面。|Write a short note first.
`.split('\n').map((line) => [line.slice(0, line.indexOf('|')), line.slice(line.indexOf('|') + 1)]),
)

export const t = (label: string) => isEnglish ? english.get(label) ?? label : label

