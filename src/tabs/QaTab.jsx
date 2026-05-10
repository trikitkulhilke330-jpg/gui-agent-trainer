import React, { useState } from 'react';
import { Search, Loader2, Play, CheckCircle2, AlertTriangle } from 'lucide-react';
import { callDeepSeek } from '../utils/ai';

export default function QaTab() {
  const [loading, setLoading] = useState(false);
  const [qaData, setQaData] = useState(null); // { scenario: '', items: [] }
  const [userScores, setUserScores] = useState({}); // { index: { score: '', comment: '', decision: '' } }
  const [showAnswers, setShowAnswers] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [qaFeedback, setQaFeedback] = useState(null);

  const generateData = async () => {
    setLoading(true);
    setShowAnswers(false);
    setUserScores({});
    setQaFeedback(null);
    try {
      const prompt = `你是一个 GUI Agent 数据生成器。我要进行质检员（QA）的考试。
请随机设定一个具体的 App 操作场景（例如：在美团点一杯星巴克生椰拿铁、在小红书搜索"北京旅游攻略"并点赞第一篇等）。

针对这个场景，生成 4 条虚构的标注数据（假设截图已经给定）。这 4 条数据必须包含以下 4 种类型（打乱顺序）：
1. 完美高质量数据（thinking充分，动作准确）
2. thinking不充分（只写了"我要点击"之类毫无信息量的话）
3. 坐标偏移/动作错误（比如要点搜索框，但给的坐标明显在屏幕底部）
4. 幻觉数据（thinking里描述了当前场景绝对不可能出现的元素，或者胡编乱造了结果）

请严格按以下 JSON 格式输出（不要有 markdown 块）：
{
  "scenario": "你设定的场景描述",
  "items": [
    {
      "id": 1,
      "type": "数据的真实类型（如：幻觉数据）",
      "thinking": "生成的 thinking 内容",
      "action": "动作描述及坐标，如 click(100, 200)",
      "target": "目标元素描述",
      "standard_score": 给出0-100的合理分数,
      "standard_decision": "通过/打回重做/拒收",
      "standard_comment": "为什么给这个分数（标准答案）"
    }
    // ...共 4 条
  ]
}`;

      const res = await callDeepSeek(prompt, true);
      // 隐藏真实类型和答案给前端，存在另一个字段里，等用户提交后再比对
      setQaData(res);
      const initialScores = {};
      res.items.forEach((_, i) => {
        initialScores[i] = { score: '', comment: '', decision: 'pass' };
      });
      setUserScores(initialScores);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    // 检查是否都填了
    const incomplete = Object.values(userScores).some(v => v.score === '' || !v.comment.trim());
    if (incomplete) {
      alert("请给所有数据打分并填写评语！");
      return;
    }
    
    setEvalLoading(true);
    try {
      const prompt = `我是一名 GUI Agent 数据质检员候选人。我刚刚对 4 条标注数据进行了质检打分。请对比我的打分和标准答案，评价我的质检水平。

【场景】${qaData.scenario}

【我的质检结果 vs 标准答案】
${qaData.items.map((item, i) => `
数据 ${i+1}: 
[原数据] thinking: ${item.thinking}, action: ${item.action}
[标准类型] ${item.type}
[标准打分] 分数: ${item.standard_score}, 决策: ${item.standard_decision}, 评语: ${item.standard_comment}
[我的打分] 分数: ${userScores[i].score}, 决策: ${userScores[i].decision}, 评语: ${userScores[i].comment}
`).join('\\n')}

请严格按以下 JSON 格式输出评价（不要有 markdown 块）：
{
  "total_score": 0-100的数字（我的质检水平得分）,
  "evaluation": "对我的质检水平的总评",
  "blind_spots": ["我没看出来的错误", "我太苛刻/太宽松的地方"]
}`;
      const res = await callDeepSeek(prompt, true);
      setQaFeedback(res);
      setShowAnswers(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setEvalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-stone-900 mb-1">质检员模式（反向训练）</h2>
          <p className="text-sm text-stone-600">你来当老师审 AI 标的数据。识别劣质数据是晋升 QA Lead 的核心能力。</p>
        </div>
        <button onClick={generateData} disabled={loading} className="bg-stone-900 text-stone-50 px-4 py-2 flex items-center gap-2 hover:bg-stone-700 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          生成考试题
        </button>
      </div>

      {!qaData && !loading && (
        <div className="border-2 border-dashed border-stone-300 bg-stone-50 p-12 text-center text-stone-500">
          点击右上角“生成考试题”开始质检挑战。
        </div>
      )}

      {loading && (
        <div className="border-2 border-dashed border-stone-300 bg-stone-50 p-12 text-center text-stone-500 flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-stone-400" />
          <p>AI 正在努力伪造劣质数据...</p>
        </div>
      )}

      {qaData && (
        <div className="space-y-6">
          <div className="bg-stone-900 text-stone-50 p-4 font-medium flex items-start gap-2">
            <Search className="w-5 h-5 flex-shrink-0 mt-0.5 text-stone-400" />
            <div>
              <div className="text-xs text-stone-400 uppercase tracking-wider mb-1">本次质检场景</div>
              <div>{qaData.scenario}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-6">
              {qaData.items.map((item, i) => (
                <div key={i} className="bg-white border-2 border-stone-300 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-stone-200 text-stone-800 px-2 py-0.5 text-xs font-bold rounded">数据 {i+1}</span>
                  </div>
                  <div className="space-y-3 mb-4">
                    <div className="text-sm">
                      <span className="font-bold text-stone-700">Thinking: </span>
                      <span className="text-stone-800">{item.thinking}</span>
                    </div>
                    <div className="text-sm font-mono bg-stone-50 p-2 border border-stone-200">
                      Action: {item.action} | Target: {item.target}
                    </div>
                  </div>
                  
                  <div className="bg-stone-50 border border-stone-300 p-3 space-y-3">
                    <div className="text-sm font-bold text-stone-800 border-b border-stone-200 pb-2">你的质检判定</div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs text-stone-500 mb-1">打分 (0-100)</label>
                        <input type="number" min="0" max="100" className="w-full px-2 py-1 border border-stone-300 focus:border-stone-900 focus:outline-none text-sm" 
                          value={userScores[i]?.score || ''} onChange={e => setUserScores({...userScores, [i]: {...userScores[i], score: e.target.value}})} disabled={showAnswers} />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-stone-500 mb-1">决策</label>
                        <select className="w-full px-2 py-1 border border-stone-300 focus:border-stone-900 focus:outline-none text-sm"
                          value={userScores[i]?.decision || 'pass'} onChange={e => setUserScores({...userScores, [i]: {...userScores[i], decision: e.target.value}})} disabled={showAnswers}>
                          <option value="pass">通过</option>
                          <option value="redo">打回重做</option>
                          <option value="reject">拒收</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-stone-500 mb-1">评语（指出问题）</label>
                      <textarea className="w-full px-2 py-1 border border-stone-300 focus:border-stone-900 focus:outline-none text-sm" rows="2"
                        value={userScores[i]?.comment || ''} onChange={e => setUserScores({...userScores, [i]: {...userScores[i], comment: e.target.value}})} disabled={showAnswers}></textarea>
                    </div>
                  </div>

                  {showAnswers && (
                    <div className="mt-4 bg-amber-50 border border-amber-300 p-3">
                      <div className="text-xs font-bold text-amber-900 mb-2">标准答案（真实类型：{item.type}）</div>
                      <div className="text-sm text-stone-800 mb-1"><strong>打分：</strong>{item.standard_score} | <strong>决策：</strong>{item.standard_decision}</div>
                      <div className="text-sm text-stone-700"><strong>评语：</strong>{item.standard_comment}</div>
                    </div>
                  )}
                </div>
              ))}
              
              {!showAnswers && (
                <button onClick={handleSubmit} disabled={evalLoading} className="w-full bg-stone-900 text-stone-50 py-3 flex items-center justify-center gap-2 hover:bg-stone-700 disabled:opacity-50">
                  {evalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  提交质检结果
                </button>
              )}
            </div>

            {/* 右侧反馈面板 */}
            <div>
              {qaFeedback ? (
                <div className="bg-stone-50 border-2 border-stone-900 sticky top-24">
                  <div className="bg-stone-900 text-stone-50 px-4 py-3 flex justify-between items-center">
                    <span className="font-bold">质检能力评估报告</span>
                    <span className="text-xl font-bold bg-stone-50 text-stone-900 px-2 py-0.5">{qaFeedback.total_score}分</span>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="bg-stone-100 p-3 text-sm text-stone-800 border-l-4 border-stone-900 italic">
                      {qaFeedback.evaluation}
                    </div>
                    
                    {qaFeedback.blind_spots?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-1"><AlertTriangle className="w-4 h-4"/> 你的质检盲区</h4>
                        <ul className="text-sm space-y-2 text-stone-700 ml-5 list-disc marker:text-red-500">
                          {qaFeedback.blind_spots.map((m, i) => <li key={i}>{m}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : showAnswers ? null : (
                <div className="h-full flex items-center justify-center border-2 border-dashed border-stone-300 bg-stone-50 text-stone-400 p-10 text-center sticky top-24">
                  认真审阅左侧数据，提交后将在这里看到你与资深 QA 的差距。
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
