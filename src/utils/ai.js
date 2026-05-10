export async function callDeepSeek(prompt, isJson = false) {
  let apiKey = localStorage.getItem('deepseek_api_key');
  if (!apiKey) {
    apiKey = window.prompt('请输入你的 DeepSeek API Key (sk-...)：\n\n注意：你的 Key 仅保存在本地浏览器中，用于调用大模型。');
    if (!apiKey) throw new Error('未提供 API Key');
    localStorage.setItem('deepseek_api_key', apiKey.trim());
  }

  const response = await fetch('/api/deepseek/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: isJson ? { type: 'json_object' } : undefined,
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem('deepseek_api_key');
      throw new Error('DeepSeek API Key 无效或已过期，请重新填写。');
    }
    throw new Error(errorData.error?.message || `请求失败，状态码：${response.status}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content;
  if (isJson) {
    try {
      return JSON.parse(text);
    } catch {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      return JSON.parse(cleaned);
    }
  }
  return text;
}
