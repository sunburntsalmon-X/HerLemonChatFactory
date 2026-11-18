/**
 * 角色脑子：普通陪聊
 *
 * 只做一件事：往提示词管线里投一段人设。
 * 换成心理咨询、全能助手，就是另写一个 runtime 模块。
 */
export default {
  id: 'runtime.chat',
  kind: 'runtime',
  api: '1.x',
  meta: { name: '普通陪聊' },

  setup(ctx) {
    ctx.prompt.register({
      id: 'runtime.chat',
      priority: 90,
      maxChars: 700,
      when: ({ character }) => (character?.runtime || 'runtime.chat') === 'runtime.chat',
      build: ({ character }) => {
        const persona = character?.persona || {};
        const traits = (persona.traits || []).join('、');
        return [
          persona.prompt || '',
          traits ? `性格关键词：${traits}。` : '',
          '用口语回复，短句，像真的在聊天。不要长篇大论，不要用括号描写动作，不要自称 AI。',
        ].filter(Boolean).join('\n');
      },
    });
  },
};
