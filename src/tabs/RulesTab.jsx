import React, { useState } from 'react';
import { ShieldAlert, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { callDeepSeek } from '../utils/ai';

export default function RulesTab() {
  const [form, setForm] = useState({
    taskDef: '',
    actionSpace: '',
    thinkingRule: '',
    grounding: '',
    ambiguity: '',
    quality: '',
    examples: ''
  });
  const [loading, setLoading] = useState(false);
  const [attacks, setAttacks] = useState(null);

  const handleAttack = async () => {
    if (Object.values(form).some(v => !v.trim())) {
      alert("请完整填写规则文档，才能进行对抗测试！");
      return;
    }
    
    setLoading(true);
    setAttacks(null);
    try {
      const prompt = `我是一名 GUI Agent 数据训练师，我写了一份【标注规范文档】。请你扮演一个极度挑剔的标注员或 QA，根据我的规则，故意构造 5 个"边缘场景 (Edge Cases)"来攻击我的规则，看我的规则是否严谨、是否能覆盖这些歧义情况。

【我的标注规范】
1. 任务定义：${form.taskDef}
2. 动作空间定义：${form.actionSpace}
3. thinking 写作规范：${form.thinkingRule}
4. grounding 精度要求：${form.grounding}
5. 歧义处理规则：${form.ambiguity}
6. 质量等级与拒绝标准：${form.quality}
7. 典型案例：${form.examples}

请严格按以下 JSON 格式输出 5 个攻击案例（不要有 markdown 块）：
{
  "attacks": [
    {
      "case_description": "描述一个刁钻的场景（如：字数刚好卡在边缘、元素被半遮挡、极其罕见的动作等）",
      "attack_question": "基于你的规则第X条，这个情况我到底该怎么标？你的规则里似乎没有说清楚...",
      "rule_flaw": "指出版规里的漏洞或不严谨之处"
    }
  ],
  "summary": "一句话总结这份规则的健壮性水平（例如：防守住了常规情况，但对异常态完全没有规定）"
}`;

      const res = await callDeepSeek(prompt, true);
      setAttacks(res);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-stone-900 mb-1">规则文档生成器（反向对抗测试）</h2>
        <p className="text-sm text-stone-600">写规则 → 接受 AI 的边缘 Case 攻击 → 完善规则。这是成为 QA Lead 的必经之路。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-stone-900 text-stone-50 px-4 py-2 font-bold flex items-center gap-2">
            <FileText className="w-4 h-4" /> 编写标注规范（以"淘宝购物"为例）
          </div>
          
          <Field label="1. 任务定义" hint="一句话讲清这次标什么">
            <textarea className="input-field" rows="2" value={form.taskDef} onChange={e => setForm({...form, taskDef: e.target.value})} placeholder="例如：在淘宝App内，从首页搜索商品直到完成支付的完整多轮轨迹..."></textarea>
          </Field>
          <Field label="2. 动作空间定义" hint="精确语义、参数、边界">
            <textarea className="input-field" rows="2" value={form.actionSpace} onChange={e => setForm({...form, actionSpace: e.target.value})} placeholder="例如：click(x,y) 必须点在可交互元素内；swipe(dir) 只能是上下左右..."></textarea>
          </Field>
          <Field label="3. thinking 写作规范" hint="结构、字数、必含要素">
            <textarea className="input-field" rows="2" value={form.thinkingRule} onChange={e => setForm({...form, thinkingRule: e.target.value})} placeholder="例如：必须包含当前状态、目标差距、下一步动作原因，字数大于50字..."></textarea>
          </Field>
          <Field label="4. grounding 精度要求" hint="坐标精度 / bbox 重叠率">
            <textarea className="input-field" rows="2" value={form.grounding} onChange={e => setForm({...form, grounding: e.target.value})} placeholder="例如：坐标必须落在元素几何中心 10% 范围内..."></textarea>
          </Field>
          <Field label="5. 歧义处理规则" hint="遇到 X 时按 Y 处理、找谁仲裁">
            <textarea className="input-field" rows="2" value={form.ambiguity} onChange={e => setForm({...form, ambiguity: e.target.value})} placeholder="例如：遇到弹窗优先关弹窗；遇到系统卡顿标 wait..."></textarea>
          </Field>
          <Field label="6. 质量等级与拒绝标准" hint="A/B/C/Reject 各自标准">
            <textarea className="input-field" rows="2" value={form.quality} onChange={e => setForm({...form, quality: e.target.value})} placeholder="例如：出现幻觉直接 Reject；标错一个动作降级为 B..."></textarea>
          </Field>
          <Field label="7. 典型案例库" hint="正例与反例">
            <textarea className="input-field" rows="2" value={form.examples} onChange={e => setForm({...form, examples: e.target.value})} placeholder="例如：正例：... 反例：..."></textarea>
          </Field>
          
          <button onClick={handleAttack} disabled={loading} className="w-full bg-red-900 text-stone-50 py-3 flex items-center justify-center gap-2 hover:bg-red-800 disabled:opacity-50 transition-colors">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
            承受 AI 边缘 Case 攻击
          </button>
        </div>

        <div>
          {attacks ? (
            <div className="bg-stone-50 border-2 border-red-900 sticky top-24">
              <div className="bg-red-900 text-stone-50 px-4 py-3 flex justify-between items-center">
                <span className="font-bold flex items-center gap-2"><ShieldAlert className="w-4 h-4"/> 规则漏洞攻击报告</span>
              </div>
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="bg-red-50 text-red-900 p-3 text-sm font-bold border border-red-200">
                  总结：{attacks.summary}
                </div>
                
                {attacks.attacks.map((atk, i) => (
                  <div key={i} className="bg-white border border-stone-300 p-4 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                    <div className="text-sm font-bold text-stone-900 mb-2 flex items-center gap-2">
                      <span className="bg-red-100 text-red-800 px-2 py-0.5 text-xs rounded">攻击 {i+1}</span>
                    </div>
                    <div className="text-sm text-stone-700 mb-2"><strong>场景：</strong>{atk.case_description}</div>
                    <div className="text-sm text-stone-700 mb-2 bg-stone-50 p-2 italic"><strong>质问：</strong>"{atk.attack_question}"</div>
                    <div className="text-sm text-red-700 mt-2 pt-2 border-t border-stone-100"><strong>规则漏洞：</strong>{atk.rule_flaw}</div>
                  </div>
                ))}
                
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>训练建议：</strong><br/>
                    看懂了这些攻击后，回到左侧修改你的规则。工业级的规范就是在这样一次次"被坑"后打磨出来的。
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-stone-300 bg-stone-50 text-stone-400 p-10 text-center">
              <ShieldAlert className="w-12 h-12 mb-3 opacity-20" />
              <p>你的规则能抗住考验吗？</p>
              <p className="text-sm mt-2">提交后，AI 会生成极度刁钻的 case 来寻找你的规则漏洞。</p>
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
      {React.cloneElement(children, { className: `${children.props.className} w-full px-3 py-2 bg-white border border-stone-300 focus:border-stone-900 focus:outline-none text-sm` })}
    </div>
  );
}
