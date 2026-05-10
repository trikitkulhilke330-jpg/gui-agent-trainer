import React, { useState } from 'react';
import { Lightbulb, Sparkles, Loader2, Check, AlertCircle } from 'lucide-react';
import { callDeepSeek } from '../utils/ai';

const REQUESTS = [
  "帮我们做个能操作小红书的 Agent，要能发笔记、刷评论、给好友点赞，年底要 demo。",
  "我们做老年人手机助手，让 AI 帮老人用支付宝、微信、滴滴。要安全。",
  "训练数据要求 10 万条，覆盖电商、金融、社交三个领域，多模态。"
];

export default function BreakdownTab() {
  const [selectedReq, setSelectedReq] = useState(REQUESTS[0]);
  const [form, setForm] = useState({
    boundary: '',
    distribution: '',
    actionSpace: '',
    quality: '',
    risk: '',
    deliverables: '',
    questions: ''
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleEvaluate = async () => {
    if (Object.values(form).some(v => !v.trim())) {
      alert("请填写完整所有拆解维度，展现你的专业度！");
      return;
    }
    
    setLoading(true);
    setFeedback(null);
    try {
      const prompt = `我正在练习 GUI Agent 数据项目的需求拆解。请你扮演一个严格但经验丰富的"百万年薪 AI 数据项目 Leader"，来点评我的拆解方案。
      
【甲方原始需求】
${selectedReq}

【我的拆解方案】
1. 场景边界（不做哪些）：${form.boundary}
2. 数据分布：${form.distribution}
3. 动作空间：${form.actionSpace}
4. 质量标准：${form.quality}
5. 风险点：${form.risk}
6. 交付物：${form.deliverables}
7. 风险追问（必须问甲方的5个问题）：${form.questions}

请严格按以下 JSON 格式输出点评（必须返回合法 JSON，不要加 markdown 代码块）：
{
  "score": 0-100的数字,
  "strengths": ["优点1", "优点2"],
  "missing": ["漏掉了什么关键点", "哪里太理想化"],
  "better_questions": ["你应该追问甲方的更深刻的问题1", "问题2"],
  "leader_comment": "一段严厉但直击要害的总评，告诉我距离高级项目经理还差在哪里"
}`;
      
      const res = await callDeepSeek(prompt, true);
      setFeedback(res);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-stone-900 mb-1">需求拆解工作台（求职杀手锏）</h2>
        <p className="text-sm text-stone-600">把模糊的甲方需求，拆解为结构化的数据方案，展现你的项目管理能力。</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4">
        <div className="text-sm font-bold text-amber-900 mb-2">选择一个真实的甲方需求：</div>
        <div className="space-y-2">
          {REQUESTS.map((req, i) => (
            <label key={i} className="flex items-start gap-2 cursor-pointer p-2 hover:bg-amber-100 transition-colors rounded">
              <input type="radio" name="req" className="mt-1" checked={selectedReq === req} onChange={() => setSelectedReq(req)} />
              <span className="text-sm text-amber-950 leading-relaxed">{req}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Field label="1. 场景边界" hint="哪些 App / 哪些任务 / 哪些功能坚决不做？">
            <textarea className="input-field" rows="2" value={form.boundary} onChange={e => setForm({...form, boundary: e.target.value})} placeholder="例如：不做支付相关操作，不做需要人脸识别的环节..."></textarea>
          </Field>
          <Field label="2. 数据分布" hint="各场景占比、难度分布、长尾 case 比例？">
            <textarea className="input-field" rows="2" value={form.distribution} onChange={e => setForm({...form, distribution: e.target.value})} placeholder="例如：基础功能占60%，异常阻断占30%，长尾占10%..."></textarea>
          </Field>
          <Field label="3. 动作空间" hint="会用到哪些 action 类型？">
            <textarea className="input-field" rows="2" value={form.actionSpace} onChange={e => setForm({...form, actionSpace: e.target.value})} placeholder="例如：click, type, swipe, scroll, back..."></textarea>
          </Field>
          <Field label="4. 质量标准" hint="单条数据合格线 / 优秀线？">
            <textarea className="input-field" rows="2" value={form.quality} onChange={e => setForm({...form, quality: e.target.value})} placeholder="例如：合格=动作可执行且到达目标；优秀=Thinking逻辑清晰且包含容错..."></textarea>
          </Field>
          <Field label="5. 风险点" hint="哪些是甲方没说但要追问的隐私、合规、能力边界？">
            <textarea className="input-field" rows="2" value={form.risk} onChange={e => setForm({...form, risk: e.target.value})} placeholder="例如：小红书存在反爬风控，老龄版验证码无法自动识别..."></textarea>
          </Field>
          <Field label="6. 交付物" hint="最终给甲方什么？">
            <textarea className="input-field" rows="2" value={form.deliverables} onChange={e => setForm({...form, deliverables: e.target.value})} placeholder="例如：10万条JSONL数据 + 标注规范文档 + 质检抽样报告..."></textarea>
          </Field>
          <Field label="7. 风险追问" hint="必须回去问甲方的 5 个致命问题？">
            <textarea className="input-field" rows="3" value={form.questions} onChange={e => setForm({...form, questions: e.target.value})} placeholder="1. 遇到需要短信验证码的步骤怎么算？\n2. 测试环境还是生产环境？..."></textarea>
          </Field>
          
          <button onClick={handleEvaluate} disabled={loading} className="w-full bg-stone-900 text-stone-50 py-3 flex items-center justify-center gap-2 hover:bg-stone-700 disabled:opacity-50">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            提交给 Leader 点评
          </button>
        </div>

        <div>
          {feedback ? (
            <div className="bg-stone-50 border-2 border-stone-900 sticky top-24">
              <div className="bg-stone-900 text-stone-50 px-4 py-3 flex justify-between items-center">
                <span className="font-bold">百万年薪 Leader 的点评</span>
                <span className="text-xl font-bold bg-stone-50 text-stone-900 px-2 py-0.5">{feedback.score}分</span>
              </div>
              <div className="p-5 space-y-5">
                <div className="bg-stone-100 p-3 text-sm text-stone-800 border-l-4 border-stone-900 italic">
                  "{feedback.leader_comment}"
                </div>
                
                {feedback.strengths?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-1"><Check className="w-4 h-4"/> 做得好的地方</h4>
                    <ul className="text-sm space-y-1 text-stone-700 ml-5 list-disc">
                      {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
                
                {feedback.missing?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-1"><AlertCircle className="w-4 h-4"/> 你的盲区/太理想化的地方</h4>
                    <ul className="text-sm space-y-2 text-stone-700 ml-5 list-disc marker:text-red-500">
                      {feedback.missing.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                )}
                
                {feedback.better_questions?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-1"><Lightbulb className="w-4 h-4"/> 高级 PM 会这么问甲方</h4>
                    <ul className="text-sm space-y-2 text-stone-700 ml-5 list-decimal marker:text-amber-500">
                      {feedback.better_questions.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-stone-300 bg-stone-50 text-stone-400 p-10 text-center">
              填写左侧拆解方案后，Leader 会在这里给你最真实的职场毒打（指导）。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-bold text-stone-800 mb-1">
        {label}
        {hint && <span className="ml-2 text-xs text-stone-500 font-normal">— {hint}</span>}
      </label>
      {React.cloneElement(children, { className: `${children.props.className} w-full px-3 py-2 bg-stone-50 border border-stone-400 focus:border-stone-900 focus:outline-none text-sm` })}
    </div>
  );
}
