import React, { useState, useEffect, useRef } from 'react';
import { Upload, Image as ImageIcon, Save, Download, BookOpen, Sparkles, FileCheck, Lightbulb, Trash2, Eye, X, Check, AlertCircle, ChevronRight, Loader2, Puzzle, FileText, Search } from 'lucide-react';
import BreakdownTab from './tabs/BreakdownTab';
import RulesTab from './tabs/RulesTab';
import QaTab from './tabs/QaTab';

// ========== 概念速查数据 ==========
const CONCEPTS = [
  {
    key: 'single_turn',
    name: '单轮数据',
    icon: '①',
    short: '一问一答，没有上下文',
    inGui: '在 GUI Agent 里就是：单独一个步骤的标注。给一张截图 + 一个任务描述，标出"这一步应该点哪里、心里在想什么"。它是构成多轮轨迹的最小单位。',
    example: '截图：购物车页面 → 任务：选中蓝色保温杯 → 标注：点击第二件商品左侧勾选框'
  },
  {
    key: 'multi_turn',
    name: '多轮数据',
    icon: '②',
    short: '多步连续，有前后文',
    inGui: '一个完整任务的全部步骤连起来。比如"在淘宝结算保温杯"是 8 步，每一步的标注都要带上"前面已经做了什么"作为历史上下文。模型才能学到"长期目标 → 当前应该做什么"的关系。',
    example: '第1步打开APP → 第2步进购物车 → 第3步勾选商品 → ... → 第8步完成支付'
  },
  {
    key: 'sft',
    name: 'SFT 监督微调',
    icon: '③',
    short: '给模型看"输入-输出"标准答案对',
    inGui: 'SFT 数据的核心是构造高质量的"输入-输出对"。在 GUI Agent 场景里，输入 = 截图 + 任务 + 历史，输出 = thinking + action。每条标注好的数据都是一对训练样本。',
    example: '输入：[截图][任务"结算保温杯"][已做：打开APP→进购物车] → 输出：[thinking][click(62,685)]'
  },
  {
    key: 'cot',
    name: 'COT 思维链',
    icon: '④',
    short: '让模型"把思考过程写出来"',
    inGui: '就是 thinking 字段。不是简单写"我要点这里"，而是要写出：目标回顾 → 看到了什么 → 候选项分析 → 选哪个 → 为什么 → 风险提示。这是 GUI Agent 数据中最值钱的部分，也是面试高频考点。',
    example: '"用户要结算蓝色保温杯。第2件是象印保温杯深海蓝，符合要求。当前未选中，需点击勾选框。注意别点到商品图片，否则会跳详情页。"'
  },
  {
    key: 'agent',
    name: 'Agent 数据',
    icon: '⑤',
    short: '会"行动"的模型，不只是聊天',
    inGui: 'Agent 数据的核心是定义清楚"动作空间"——模型可以做哪些动作。在 GUI 场景里通常是：click（点击）、type（输入）、scroll（滑动）、swipe（滑屏）、wait（等待）、finish（完成）。每条数据的 action 字段必须严格遵守这个空间。',
    example: 'action: { type: "click", coordinate: [62, 685], target: "勾选框" }'
  },
  {
    key: 'multimodal',
    name: '多模态数据',
    icon: '⑥',
    short: '文字 + 图像/视频/音频',
    inGui: 'GUI Agent 是典型的多模态：输入有图（截图）有文字（任务+历史），输出也要把文字（thinking）和视觉位置（坐标/bbox）对齐。grounding（视觉接地）是难点：把"那个勾选框"对应到屏幕上的具体像素位置。',
    example: '"第二件商品左侧的勾选框" → 坐标 (62, 685) + bbox [40, 663, 84, 707]'
  }
];

// ========== 范例对照数据 ==========
const EXAMPLES = [
  {
    scene: '购物车勾选商品',
    task: '在淘宝把购物车里的蓝色保温杯结算了',
    good: {
      thinking: '用户的目标是结算蓝色保温杯并用花呗付款。我现在在购物车页面，需要先选中目标商品。观察页面，第二件商品的描述是"象印保温杯500ml 深海蓝"，符合"蓝色保温杯"的描述。当前它的勾选框是空心的，说明未选中。我需要点击这个勾选框来选中它。注意不要点到商品图片上，否则会跳转到商品详情页。',
      action_type: 'click',
      target: '第二件商品（象印保温杯）左侧的勾选框',
      coordinate: '[62, 685]',
      why: '✓ 回顾了用户最终目标\n✓ 描述了当前看到的画面\n✓ 解释了为什么选这个元素（识别出"蓝色保温杯"对应"深海蓝"）\n✓ 提示了风险（误点商品图会跳详情页）\n✓ 坐标精确指向勾选框，不会误触'
    },
    bad: {
      thinking: '点保温杯',
      action_type: 'click',
      target: '保温杯',
      coordinate: '[200, 700]',
      why: '✗ thinking 只有4个字，模型学不到"该怎么思考"\n✗ target 描述模糊，不知道点的是商品本身还是勾选框\n✗ 坐标 (200, 700) 落在商品图片上，点下去会跳详情页，任务失败\n✗ 没意识到页面里还有"蓝色雨伞"这个干扰项'
    }
  },
  {
    scene: '搜索框输入文字',
    task: '在淘宝搜索"无线耳机"',
    good: {
      thinking: '用户要搜索"无线耳机"。当前是淘宝首页，顶部有一个搜索框，灰色提示文字写着"搜索"。我需要先点击这个搜索框激活输入状态，然后才能输入文字。当前还没点击过搜索框，所以这一步先点击它。下一步再输入"无线耳机"。',
      action_type: 'click',
      target: '顶部搜索框',
      coordinate: '[540, 180]',
      why: '✓ 拆解成"先点击激活，再输入"两步，符合真实操作逻辑\n✓ 明确说明当前是哪一步\n✓ 预告了下一步要做什么（让多轮逻辑连贯）'
    },
    bad: {
      thinking: '搜索无线耳机',
      action_type: 'type',
      target: '搜索框',
      coordinate: '[540, 180]',
      why: '✗ 跳过了"先点击激活搜索框"这一步，直接 type 在很多 App 上不生效\n✗ 没说清楚现在是激活状态还是未激活状态\n✗ thinking 信息量为零'
    }
  },
  {
    scene: '处理弹窗',
    task: '打开美团 App 浏览附近餐厅',
    good: {
      thinking: '用户要浏览附近餐厅。但当前页面弹出了"是否允许定位权限"的系统弹窗，遮挡了主界面。这个弹窗必须先处理才能继续。考虑到任务需要"附近"餐厅，必须有定位权限才行，所以应该点击"允许"按钮。',
      action_type: 'click',
      target: '定位权限弹窗的"允许"按钮',
      coordinate: '[810, 1350]',
      why: '✓ 识别出弹窗是临时阻断，不是主流程\n✓ 把弹窗选项与任务目标关联（需要定位才能找附近餐厅）\n✓ 教会模型"遇到弹窗先处理再继续"的通用模式'
    },
    bad: {
      thinking: '继续任务',
      action_type: 'click',
      target: '弹窗',
      coordinate: '[540, 1200]',
      why: '✗ 没识别出弹窗的具体内容是什么\n✗ 没说明点击哪个按钮（允许还是拒绝）\n✗ 坐标落在弹窗中间，可能根本不是按钮位置'
    }
  }
];

// ========== Storage 工具 ==========
const STORAGE_KEY = 'gui_annotations';

async function loadAnnotations() {
  try {
    const result = localStorage.getItem(STORAGE_KEY);
    return result ? JSON.parse(result) : [];
  } catch {
    return [];
  }
}

async function saveAnnotations(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error('保存失败', e);
    return false;
  }
}

// ========== 主应用 ==========
export default function App() {
  const [tab, setTab] = useState('annotate');
  const [annotations, setAnnotations] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadAnnotations().then(list => {
      setAnnotations(list);
      setLoaded(true);
    });
  }, []);

  const handleSave = async (record) => {
    const newList = [{ ...record, id: Date.now(), created_at: new Date().toISOString() }, ...annotations];
    setAnnotations(newList);
    await saveAnnotations(newList);
  };

  const handleDelete = async (id) => {
    const newList = annotations.filter(a => a.id !== id);
    setAnnotations(newList);
    await saveAnnotations(newList);
  };

  return (
    <div className="min-h-screen" style={{ background: '#f4f1ea', fontFamily: '"Noto Serif SC", "Source Han Serif SC", serif' }}>
      {/* 顶部导航 */}
      <header className="border-b-2 border-stone-900 bg-stone-50 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
              GUI Agent 数据训练师工作台
            </h1>
            <span className="text-xs text-stone-500 tracking-widest">v1.0 · 自学版</span>
          </div>
          <nav className="flex gap-1 text-sm flex-wrap">
            {[
              { id: 'annotate', name: '标注台', icon: '✎' },
              { id: 'breakdown', name: '需求拆解', icon: <Puzzle className="w-4 h-4 inline" /> },
              { id: 'rules', name: '规则文档', icon: <FileText className="w-4 h-4 inline" /> },
              { id: 'qa', name: '质检台', icon: <Search className="w-4 h-4 inline" /> },
              { id: 'library', name: `样本库 (${annotations.length})`, icon: '◫' },
              { id: 'examples', name: '范例对照', icon: '⚖' },
              { id: 'concepts', name: '概念速查', icon: '✦' }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 transition-all border-2 ${
                  tab === t.id
                    ? 'bg-stone-900 text-stone-50 border-stone-900'
                    : 'bg-transparent text-stone-700 border-transparent hover:border-stone-300'
                }`}
              >
                <span className="mr-1.5">{t.icon}</span>{t.name}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {tab === 'annotate' && <AnnotateTab onSave={handleSave} />}
        {tab === 'breakdown' && <BreakdownTab />}
        {tab === 'rules' && <RulesTab />}
        {tab === 'qa' && <QaTab />}
        {tab === 'library' && <LibraryTab annotations={annotations} loaded={loaded} onDelete={handleDelete} />}
        {tab === 'examples' && <ExamplesTab />}
        {tab === 'concepts' && <ConceptsTab />}
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-8 text-center text-xs text-stone-500 border-t border-stone-300 mt-12">
        练习是最好的老师 · 你标的每一条都会成为面试时的作品集
      </footer>
    </div>
  );
}

// ========== 标注台 ==========
function AnnotateTab({ onSave }) {
  const [screenshot, setScreenshot] = useState(null); // { data: base64, mediaType, width, height }
  const [task, setTask] = useState('');
  const [history, setHistory] = useState('');
  const [observation, setObservation] = useState('');
  const [thinking, setThinking] = useState('');
  const [actionType, setActionType] = useState('click');
  const [target, setTarget] = useState('');
  const [coordinate, setCoordinate] = useState('');
  const [typeText, setTypeText] = useState('');
  const [expectedResult, setExpectedResult] = useState('');

  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiSample, setAiSample] = useState(null);
  const [savedTip, setSavedTip] = useState(false);

  const fileInputRef = useRef(null);
  const imgRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const base64 = dataUrl.split(',')[1];
      const mediaType = file.type;
      const img = new Image();
      img.onload = () => {
        setScreenshot({ data: base64, mediaType, dataUrl, width: img.width, height: img.height });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleImageClick = (e) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const scaleX = screenshot.width / rect.width;
    const scaleY = screenshot.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    setCoordinate(`[${x}, ${y}]`);
  };

  const buildRecord = () => ({
    task,
    history,
    observation,
    thinking,
    action: {
      type: actionType,
      target,
      coordinate,
      ...(actionType === 'type' ? { text: typeText } : {})
    },
    expected_result: expectedResult,
    has_screenshot: !!screenshot
  });

  const handleAIReview = async () => {
    if (!task || !thinking) {
      setFeedback({ error: '请至少填写"任务描述"和"思考过程"两项' });
      return;
    }
    
    let apiKey = localStorage.getItem('anthropic_api_key');
    if (!apiKey) {
      apiKey = window.prompt('请输入你的 Anthropic API Key (sk-ant-...)：\n\n注意：你的 Key 仅保存在本地浏览器中，用于调用大模型审核你的标注。');
      if (!apiKey) return;
      localStorage.setItem('anthropic_api_key', apiKey.trim());
    }

    setLoading(true);
    setFeedback(null);
    setAiSample(null);

    const userContent = [];
    if (screenshot) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: screenshot.mediaType, data: screenshot.data }
      });
    }
    userContent.push({
      type: 'text',
      text: `我是一个 GUI Agent 数据训练师，正在练习标注。请你扮演资深审核老师，用中文严格审核我的标注质量，并给出你自己的高质量版本作为对照。

【任务】${task}
【历史步骤】${history || '（未填）'}
【当前观察】${observation || '（未填）'}
【我的思考过程】${thinking}
【我的动作】类型=${actionType}，目标=${target || '（未填）'}，坐标=${coordinate || '（未填）'}${actionType === 'type' ? `，输入文字=${typeText}` : ''}
【预期结果】${expectedResult || '（未填）'}

请严格按以下 JSON 格式输出，不要有任何额外文字、不要用 markdown 代码块包裹：
{
  "score": 数字0-100,
  "strengths": ["优点1", "优点2"],
  "issues": [
    {"dimension": "维度名（如：thinking深度/动作精确度/歧义识别/格式规范）", "problem": "问题描述", "suggestion": "改进建议"}
  ],
  "ai_version": {
    "thinking": "你写的高质量 thinking",
    "target": "更精确的目标元素描述",
    "expected_result": "更具体的预期结果"
  },
  "key_lesson": "本次最值得记住的一句话教训"
}`
    });

    try {
      const response = await fetch('/api/anthropic/v1/messages', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 1500,
          messages: [{ role: 'user', content: userContent }]
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          localStorage.removeItem('anthropic_api_key');
          throw new Error('API Key 无效或已过期，请重新填写。');
        }
        throw new Error(errorData.error?.message || `请求失败，状态码：${response.status}`);
      }
      const data = await response.json();
      const text = data.content.map(b => b.text || '').join('').trim();
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      setFeedback(parsed);
      setAiSample(parsed.ai_version);
    } catch (err) {
      console.error(err);
      setFeedback({ error: err.message || '审核失败，请稍后重试。可能是网络问题。' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!task || !thinking) {
      alert('至少填写"任务描述"和"思考过程"才能保存');
      return;
    }
    await onSave({ ...buildRecord(), ai_review: feedback });
    setSavedTip(true);
    setTimeout(() => setSavedTip(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 左侧：截图 + 任务 */}
      <div className="space-y-5">
        <Section title="第一步：上传截图" num="1">
          {!screenshot ? (
            <div
              className="border-2 border-dashed border-stone-400 bg-stone-100 p-10 text-center cursor-pointer hover:bg-stone-200 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-stone-500" strokeWidth={1.5} />
              <p className="text-stone-700 mb-1">点击或拖入截图</p>
              <p className="text-xs text-stone-500">手机截图、网页截图、桌面截图都可以</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="relative bg-stone-200 border border-stone-400">
              <img
                ref={imgRef}
                src={screenshot.dataUrl}
                alt="screenshot"
                onClick={handleImageClick}
                className="w-full h-auto cursor-crosshair"
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={() => setScreenshot(null)}
                  className="bg-stone-900 text-stone-50 p-1.5 hover:bg-stone-700"
                  title="移除"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-3 py-2 bg-stone-900 text-stone-50 text-xs flex justify-between">
                <span>原始尺寸 {screenshot.width} × {screenshot.height}</span>
                <span>👆 点击图片自动获取坐标</span>
              </div>
            </div>
          )}
        </Section>

        <Section title="第二步：写任务和上下文" num="2">
          <Field label="任务描述（必填）" hint="用户要让 Agent 完成什么">
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="例如：在淘宝把购物车里的蓝色保温杯结算了，用花呗付款"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-400 focus:border-stone-900 focus:outline-none text-sm"
              rows="2"
            />
          </Field>
          <Field label="历史步骤" hint="如果是任务的中间步骤，简述前面已经做了什么">
            <textarea
              value={history}
              onChange={(e) => setHistory(e.target.value)}
              placeholder="例如：1. 打开淘宝APP  2. 点击底部购物车tab"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-400 focus:border-stone-900 focus:outline-none text-sm"
              rows="2"
            />
          </Field>
          <Field label="当前观察（页面看到了什么）" hint="客观描述当前界面的关键元素">
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="例如：购物车页面，5件商品，第2件是象印保温杯深海蓝，价格189元，勾选框未选中"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-400 focus:border-stone-900 focus:outline-none text-sm"
              rows="3"
            />
          </Field>
        </Section>
      </div>

      {/* 右侧：思考 + 动作 + AI审核 */}
      <div className="space-y-5">
        <Section title="第三步：写思考过程（最重要！）" num="3" highlight>
          <div className="bg-amber-50 border-l-4 border-amber-700 p-3 mb-3 text-xs text-stone-700">
            <strong>高质量 thinking 的写作公式：</strong><br />
            ① 回顾用户目标 → ② 描述当前看到 → ③ 候选项分析 → ④ 选定动作 → ⑤ 风险/陷阱提示
          </div>
          <Field label="思考过程（必填）" hint="假装你在教外星人——把心里想的全写出来">
            <textarea
              value={thinking}
              onChange={(e) => setThinking(e.target.value)}
              placeholder="用户的目标是... 我现在看到... 第2件商品符合'蓝色保温杯'的描述... 我应该点击... 注意不要点到... "
              className="w-full px-3 py-2 bg-stone-50 border border-stone-400 focus:border-stone-900 focus:outline-none text-sm"
              rows="6"
            />
            <div className="text-xs text-stone-500 mt-1">{thinking.length} 字 · 建议 80-200 字</div>
          </Field>
        </Section>

        <Section title="第四步：标动作" num="4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="动作类型">
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-400 focus:border-stone-900 focus:outline-none text-sm"
              >
                <option value="click">click 点击</option>
                <option value="type">type 输入文字</option>
                <option value="scroll">scroll 滚动</option>
                <option value="swipe">swipe 滑屏</option>
                <option value="long_press">long_press 长按</option>
                <option value="wait">wait 等待</option>
                <option value="finish">finish 完成</option>
              </select>
            </Field>
            <Field label="坐标 [x, y]">
              <input
                value={coordinate}
                onChange={(e) => setCoordinate(e.target.value)}
                placeholder="点击图片自动填入"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-400 focus:border-stone-900 focus:outline-none text-sm font-mono"
              />
            </Field>
          </div>
          <Field label="目标元素描述" hint="精确说明点的是什么 UI 元素">
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="例如：第二件商品（象印保温杯）左侧的勾选框"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-400 focus:border-stone-900 focus:outline-none text-sm"
            />
          </Field>
          {actionType === 'type' && (
            <Field label="输入文字">
              <input
                value={typeText}
                onChange={(e) => setTypeText(e.target.value)}
                placeholder="例如：无线耳机"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-400 focus:border-stone-900 focus:outline-none text-sm"
              />
            </Field>
          )}
          <Field label="预期结果" hint="点完之后页面会发生什么变化">
            <input
              value={expectedResult}
              onChange={(e) => setExpectedResult(e.target.value)}
              placeholder="例如：勾选框变蓝，底部合计金额从 ¥0 变为 ¥189"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-400 focus:border-stone-900 focus:outline-none text-sm"
            />
          </Field>
        </Section>

        <div className="flex gap-3">
          <button
            onClick={handleAIReview}
            disabled={loading}
            className="flex-1 bg-stone-900 text-stone-50 py-3 px-4 hover:bg-stone-700 disabled:bg-stone-400 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'AI 老师审核中...' : 'AI 老师审核我的标注'}
          </button>
          <button
            onClick={handleSave}
            className="bg-stone-50 border-2 border-stone-900 text-stone-900 py-3 px-5 hover:bg-stone-900 hover:text-stone-50 transition-colors flex items-center gap-2 font-medium"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
        </div>
        {savedTip && (
          <div className="text-sm text-emerald-700 flex items-center gap-1.5">
            <Check className="w-4 h-4" /> 已保存到样本库
          </div>
        )}

        {feedback && <FeedbackPanel feedback={feedback} />}
      </div>
    </div>
  );
}

function Section({ title, num, highlight, children }) {
  return (
    <div className={`bg-stone-50 border ${highlight ? 'border-amber-700' : 'border-stone-300'} p-5`}>
      <h3 className="text-base font-bold text-stone-900 mb-4 flex items-center gap-2">
        {num && <span className={`inline-flex items-center justify-center w-6 h-6 text-xs ${highlight ? 'bg-amber-700' : 'bg-stone-900'} text-stone-50`}>{num}</span>}
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-800 mb-1">
        {label}
        {hint && <span className="ml-2 text-xs text-stone-500 font-normal">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function FeedbackPanel({ feedback }) {
  if (feedback.error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-700 p-4 text-sm text-red-900 flex items-start gap-2">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>{feedback.error}</div>
      </div>
    );
  }

  const scoreColor = feedback.score >= 80 ? 'text-emerald-700' : feedback.score >= 60 ? 'text-amber-700' : 'text-red-700';

  return (
    <div className="border-2 border-stone-900 bg-stone-50">
      <div className="bg-stone-900 text-stone-50 px-4 py-3 flex items-center justify-between">
        <span className="font-bold">AI 老师审核报告</span>
        <span className={`text-2xl font-bold ${scoreColor.replace('text-', 'text-')} bg-stone-50 px-3 py-0.5`}>
          {feedback.score}<span className="text-sm">/100</span>
        </span>
      </div>
      <div className="p-4 space-y-4">
        {feedback.strengths?.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-emerald-800 mb-1.5 flex items-center gap-1">
              <Check className="w-4 h-4" /> 做得好的地方
            </h4>
            <ul className="text-sm space-y-1 text-stone-700 ml-5">
              {feedback.strengths.map((s, i) => <li key={i} className="list-disc">{s}</li>)}
            </ul>
          </div>
        )}
        {feedback.issues?.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-red-800 mb-1.5 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" /> 需要改进
            </h4>
            <div className="space-y-2">
              {feedback.issues.map((iss, i) => (
                <div key={i} className="bg-stone-100 border-l-2 border-red-700 p-3 text-sm">
                  <div className="font-medium text-stone-900">[{iss.dimension}] {iss.problem}</div>
                  <div className="text-stone-600 mt-1">→ {iss.suggestion}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {feedback.ai_version && (
          <div>
            <h4 className="text-sm font-bold text-stone-900 mb-1.5 flex items-center gap-1">
              <Sparkles className="w-4 h-4" /> AI 老师的高质量版本
            </h4>
            <div className="bg-amber-50 border border-amber-300 p-3 text-sm space-y-2">
              <div><strong>thinking:</strong> {feedback.ai_version.thinking}</div>
              <div><strong>target:</strong> {feedback.ai_version.target}</div>
              <div><strong>expected_result:</strong> {feedback.ai_version.expected_result}</div>
            </div>
          </div>
        )}
        {feedback.key_lesson && (
          <div className="bg-stone-900 text-stone-50 p-3 text-sm italic">
            💡 {feedback.key_lesson}
          </div>
        )}
      </div>
    </div>
  );
}

// ========== 样本库 ==========
function LibraryTab({ annotations, loaded, onDelete }) {
  const [viewing, setViewing] = useState(null);

  const exportJSONL = () => {
    const lines = annotations.map(a => JSON.stringify({
      task: a.task,
      history: a.history,
      observation: a.observation,
      thinking: a.thinking,
      action: a.action,
      expected_result: a.expected_result
    })).join('\n');
    const blob = new Blob([lines], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gui_agent_annotations_${new Date().toISOString().slice(0,10)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!loaded) return <div className="text-stone-500">加载中...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900">我的样本库</h2>
          <p className="text-sm text-stone-600 mt-1">这里是你的"作品集"——面试时直接打开给面试官看</p>
        </div>
        {annotations.length > 0 && (
          <button
            onClick={exportJSONL}
            className="bg-stone-900 text-stone-50 px-4 py-2 hover:bg-stone-700 flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" /> 导出 JSONL ({annotations.length} 条)
          </button>
        )}
      </div>

      {annotations.length === 0 ? (
        <div className="bg-stone-50 border border-dashed border-stone-400 p-12 text-center">
          <FileCheck className="w-12 h-12 mx-auto mb-3 text-stone-400" strokeWidth={1.5} />
          <p className="text-stone-600 mb-1">还没有标注样本</p>
          <p className="text-xs text-stone-500">去"标注台"完成你的第一条标注吧</p>
        </div>
      ) : (
        <div className="space-y-3">
          {annotations.map(a => (
            <div key={a.id} className="bg-stone-50 border border-stone-300 p-4 hover:border-stone-900 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-stone-900 text-stone-50 px-2 py-0.5">{a.action?.type || '?'}</span>
                    {a.ai_review?.score && (
                      <span className={`text-xs px-2 py-0.5 ${a.ai_review.score >= 80 ? 'bg-emerald-100 text-emerald-800' : a.ai_review.score >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                        {a.ai_review.score}分
                      </span>
                    )}
                    <span className="text-xs text-stone-500">{new Date(a.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                  <div className="font-medium text-stone-900 truncate">{a.task}</div>
                  <div className="text-sm text-stone-600 mt-1 line-clamp-2">{a.thinking}</div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => setViewing(a)} className="p-2 hover:bg-stone-200" title="查看"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => { if(confirm('确定删除？')) onDelete(a.id); }} className="p-2 hover:bg-red-100 text-red-700" title="删除"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewing && <DetailModal annotation={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function DetailModal({ annotation, onClose }) {
  return (
    <div className="fixed inset-0 bg-stone-900/70 z-30 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-stone-50 max-w-3xl w-full max-h-[85vh] overflow-y-auto border-2 border-stone-900" onClick={(e) => e.stopPropagation()}>
        <div className="bg-stone-900 text-stone-50 px-5 py-3 flex items-center justify-between sticky top-0">
          <span className="font-bold">样本详情</span>
          <button onClick={onClose} className="hover:opacity-70"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <Detail k="任务" v={annotation.task} />
          <Detail k="历史" v={annotation.history} />
          <Detail k="观察" v={annotation.observation} />
          <Detail k="思考" v={annotation.thinking} highlight />
          <Detail k="动作" v={JSON.stringify(annotation.action, null, 2)} mono />
          <Detail k="预期结果" v={annotation.expected_result} />
          {annotation.ai_review && !annotation.ai_review.error && (
            <div className="border-t border-stone-300 pt-3 mt-3">
              <div className="font-bold text-stone-900 mb-2">AI 审核（得分 {annotation.ai_review.score}）</div>
              {annotation.ai_review.key_lesson && <div className="bg-stone-900 text-stone-50 p-2 italic">💡 {annotation.ai_review.key_lesson}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ k, v, highlight, mono }) {
  if (!v) return null;
  return (
    <div>
      <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">{k}</div>
      <div className={`${highlight ? 'bg-amber-50 border-l-2 border-amber-700 p-2' : ''} ${mono ? 'font-mono text-xs whitespace-pre' : ''} text-stone-800`}>{v}</div>
    </div>
  );
}

// ========== 范例对照 ==========
function ExamplesTab() {
  const [idx, setIdx] = useState(0);
  const ex = EXAMPLES[idx];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-stone-900 mb-1">好数据 vs 烂数据</h2>
        <p className="text-sm text-stone-600">每个场景看完，你的"质量直觉"就提升一档</p>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {EXAMPLES.map((e, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`px-4 py-2 text-sm border-2 transition-all ${
              idx === i ? 'bg-stone-900 text-stone-50 border-stone-900' : 'bg-stone-50 text-stone-700 border-stone-300 hover:border-stone-700'
            }`}
          >
            场景 {i + 1}：{e.scene}
          </button>
        ))}
      </div>

      <div className="bg-stone-50 border border-stone-300 p-5 mb-5">
        <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">用户任务</div>
        <div className="text-stone-900">{ex.task}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 好数据 */}
        <div className="bg-emerald-50 border-2 border-emerald-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-emerald-700 text-stone-50 px-2 py-0.5 text-xs font-bold">GOOD</span>
            <span className="font-bold text-emerald-900">高质量标注</span>
          </div>
          <ExamplePart label="thinking" value={ex.good.thinking} />
          <ExamplePart label="action" value={`${ex.good.action_type} → ${ex.good.target}`} />
          <ExamplePart label="坐标" value={ex.good.coordinate} mono />
          <div className="mt-4 pt-3 border-t border-emerald-300">
            <div className="text-xs font-bold text-emerald-800 mb-2">为什么是好的？</div>
            <pre className="text-xs text-emerald-900 whitespace-pre-wrap font-sans leading-relaxed">{ex.good.why}</pre>
          </div>
        </div>

        {/* 烂数据 */}
        <div className="bg-red-50 border-2 border-red-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-red-700 text-stone-50 px-2 py-0.5 text-xs font-bold">BAD</span>
            <span className="font-bold text-red-900">低质量标注</span>
          </div>
          <ExamplePart label="thinking" value={ex.bad.thinking} />
          <ExamplePart label="action" value={`${ex.bad.action_type} → ${ex.bad.target}`} />
          <ExamplePart label="坐标" value={ex.bad.coordinate} mono />
          <div className="mt-4 pt-3 border-t border-red-300">
            <div className="text-xs font-bold text-red-800 mb-2">问题在哪？</div>
            <pre className="text-xs text-red-900 whitespace-pre-wrap font-sans leading-relaxed">{ex.bad.why}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExamplePart({ label, value, mono }) {
  return (
    <div className="mb-3">
      <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-sm text-stone-800 ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

// ========== 概念速查 ==========
function ConceptsTab() {
  const [open, setOpen] = useState('cot');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-stone-900 mb-1">六大概念在 GUI Agent 里的具体含义</h2>
        <p className="text-sm text-stone-600">所有抽象术语，都有一个具体的对应场景。看完这页，你的概念体系就串起来了。</p>
      </div>

      <div className="space-y-3">
        {CONCEPTS.map(c => (
          <div key={c.key} className="bg-stone-50 border border-stone-300">
            <button
              onClick={() => setOpen(open === c.key ? null : c.key)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-stone-100 transition-colors text-left"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <span className="text-2xl text-stone-700">{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-stone-900">{c.name}</div>
                  <div className="text-sm text-stone-600 truncate">{c.short}</div>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 text-stone-500 transition-transform ${open === c.key ? 'rotate-90' : ''}`} />
            </button>
            {open === c.key && (
              <div className="border-t border-stone-300 p-5 bg-stone-100">
                <div className="mb-4">
                  <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">在 GUI Agent 里是什么</div>
                  <div className="text-sm text-stone-800 leading-relaxed">{c.inGui}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">具体例子</div>
                  <div className="text-sm bg-stone-50 border-l-2 border-stone-900 p-3 text-stone-700 font-mono">{c.example}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 bg-amber-50 border-2 border-amber-700 p-5">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-6 h-6 text-amber-700 flex-shrink-0" />
          <div className="text-sm text-stone-800 leading-relaxed">
            <strong className="text-amber-900">融会贯通：</strong>
            一条完整的 GUI Agent 标注 = 单轮 + 多轮（带 history）+ SFT（输入-输出对）+ COT（thinking 字段）+ Agent（标准动作空间）+ 多模态（图像+文本+grounding）。
            <strong className="block mt-2 text-stone-900">所以你只要把这一个场景练透，所有概念就都活了。</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
