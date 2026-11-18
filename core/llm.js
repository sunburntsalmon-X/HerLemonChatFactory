/**
 * 模型通道
 *
 * 只负责"把一段对话变成一串流式返回的字"，不管人设、不管记忆。
 * 没配密钥时走演示模式，本地生成回复，不联网。
 */
import { sleep } from './dom.js';

export function createLLM({ settings, bus }) {
  async function* stream({ character, messages, system, signal }) {
    const provider = settings.get('ai.provider', 'mock');
    const key = await settings.getKey();

    if (provider === 'mock' || !key) {
      yield* mockStream({ character, messages, signal });
      return;
    }

    yield* openaiStream({
      baseUrl: settings.get('ai.baseUrl', ''),
      model: settings.get('ai.model', ''),
      key,
      system,
      messages,
      temperature: settings.get('ai.params.temperature', 0.9),
      signal,
    });
  }

  bus.emit('llm:ready', {});
  return { stream };
}

async function* openaiStream({ baseUrl, model, key, system, messages, temperature, signal }) {
  if (!baseUrl) throw new Error('还没填接口地址');
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      stream: true,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`接口返回 ${res.status}：${detail.slice(0, 120)}`);
  }
  if (!res.body) throw new Error('这个接口不支持流式返回');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        /* 不完整的一行，丢掉 */
      }
    }
  }
}

/** 演示模式：不联网也能看到完整的打字效果 */
async function* mockStream({ character, messages, signal }) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const reply = composeMock(character, lastUser);
  const pieces = chunk(reply);
  for (const piece of pieces) {
    if (signal?.aborted) throw Object.assign(new Error('已中断'), { name: 'AbortError' });
    await sleep(22 + Math.random() * 40);
    yield piece;
  }
}

function composeMock(character, text) {
  const name = character?.name || '它';
  const snippet = text.replace(/\s+/g, ' ').slice(0, 16);

  if (!snippet) return '嗯？';
  if (/[?？]\s*$/.test(text)) {
    return `（${name}停顿了一会儿）\n你说的这个，我得想想。\n你自己是怎么想的？`;
  }
  if (text.length < 4) return '嗯。你说。';

  const tails = [
    '……我记着了。',
    '你先别急着下结论。',
    '这话你以前没说过。',
    '行，我知道了。',
  ];
  const tail = tails[Math.floor(Math.random() * tails.length)];
  return `「${snippet}」\n${tail}`;
}

function chunk(text) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const size = 1 + Math.floor(Math.random() * 3);
    out.push(text.slice(i, i + size));
    i += size;
  }
  return out;
}
