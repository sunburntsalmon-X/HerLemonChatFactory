/**
 * 提示词管线
 *
 * 人设、记忆、世界书都不自己拼字符串，而是往这里"投段落"：
 * 声明优先级、最多占多少字，内核统一排序、按总预算裁剪。
 *
 * 好处：谁也别想撑爆上下文；出问题能看清每一段是谁加的。
 */
export function createPrompt() {
  const contributors = [];
  let lastBuild = null;

  return {
    register(contributor) {
      if (!contributor?.id) throw new Error('提示词贡献者必须有 id');
      contributors.push({
        priority: 50,
        maxChars: 600,
        ...contributor,
      });
    },

    list() {
      return contributors.map((c) => ({ id: c.id, priority: c.priority, maxChars: c.maxChars }));
    },

    /** 热重装时会重新 register，先把旧的清掉，避免同一条人设被拼两遍 */
    reset() {
      contributors.length = 0;
      lastBuild = null;
    },

    /**
     * @param {object} ctx - { character, history, userText, settings }
     * @param {number} budget - 总字数预算（中文大致 1 字 ≈ 1.5 token）
     */
    build(ctx, budget = 2000) {
      const candidates = contributors
        .filter((c) => (c.when ? c.when(ctx) : true))
        .sort((a, b) => b.priority - a.priority)
        .map((c) => ({
          id: c.id,
          text: String(c.build(ctx) || '').trim().slice(0, c.maxChars),
          maxChars: c.maxChars,
        }))
        .filter((c) => c.text);

      const kept = [];
      const dropped = [];
      let used = 0;

      for (const part of candidates) {
        const room = budget - used;
        if (room <= 0) {
          dropped.push({ ...part, reason: '超出预算' });
          continue;
        }
        const text = part.text.length > room ? part.text.slice(0, room) : part.text;
        kept.push({ ...part, text, truncated: text.length < part.text.length });
        used += text.length;
      }

      lastBuild = {
        system: kept.map((p) => p.text).join('\n\n'),
        parts: kept,
        dropped,
        budget,
        used,
        at: Date.now(),
      };
      return lastBuild;
    },

    lastBuild: () => lastBuild,
  };
}
