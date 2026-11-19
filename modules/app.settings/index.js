/**
 * 应用：设置
 *
 * 界面由各模块声明的设置项自动生成——加一个模块，设置页自己就长出来了。
 */
export default {
  id: 'app.settings',
  kind: 'app',
  api: '1.x',
  meta: { name: '设置', icon: '⚙', color: '#3f4756' },

  mount(body, ctx, api) {
    const { h, toast } = ctx.ui;
    const wrap = h('div', { class: 'settings scroll' });

    for (const group of ctx.bus.settings.all()) {
      const rows = (group.fields || []).map((field) => fieldRow(group, field));
      if (!rows.length) continue;
      wrap.append(h('div', { class: 'group' }, h('h2', {}, group.title || group.id), rows));
    }

    wrap.append(dataGroup());
    wrap.append(h('div', {
      style: {
        textAlign: 'center', color: 'var(--dim)',
        fontSize: '11px', padding: '18px 0 40px',
      },
    }, `小手机内核 v0.1 · ${ctx.bus.settings.all().length} 组设置`));

    body.replaceChildren(wrap);

    /* ------------- 设置项 ------------- */

    function fieldRow(group, field) {
      const value = field.get ? '' : ctx.settings.get(field.key, '');

      const save = async (next) => {
        try {
          if (field.set) await field.set(next);
          else await ctx.settings.set(field.key, next);
        } catch (err) {
          console.error('[settings]', err);
          toast('没保存上');
        }
      };

      let control;
      switch (field.type) {
        case 'select':
          control = h('select', {},
            (field.options || []).map(([valueKey, label]) =>
              h('option', { value: valueKey, selected: String(value) === String(valueKey) }, label)));
          control.addEventListener('change', () => save(control.value));
          break;

        case 'color':
          control = h('input', { type: 'color', value: value || '#5eead4' });
          control.addEventListener('input', () => save(control.value));
          break;

        case 'range':
          control = h('input', {
            type: 'range',
            min: field.min ?? 0, max: field.max ?? 40,
            value: value ?? 20,
          });
          control.addEventListener('input', () => save(Number(control.value)));
          break;

        case 'number':
          control = h('input', {
            type: 'number',
            min: field.min ?? 0, max: field.max ?? 999,
            value: value ?? '',
            placeholder: field.placeholder || '',
          });
          control.addEventListener('change', () => save(Number(control.value) || 0));
          break;

        case 'password':
          control = h('input', {
            type: 'password', value: '',
            placeholder: '粘贴密钥后回车',
            autocomplete: 'off',
          });
          control.addEventListener('change', () => {
            if (!control.value.trim()) return;
            save(control.value.trim()).then(() => {
              control.value = '';
              toast('密钥已存在本机');
            });
          });
          break;

        default:
          control = h('input', {
            type: 'text', value: value ?? '',
            placeholder: field.placeholder || '',
          });
          control.addEventListener('change', () => save(control.value));
      }

      return h('div', { class: 'field' },
        h('label', {}, field.label || field.key),
        control,
        field.hint ? h('span', { class: 'hint' }, field.hint) : null);
    }

    /* ------------- 数据 ------------- */

    function dataGroup() {
      const dump = h('div', { class: 'prompt-dump', style: { display: 'none' } });

      const fileInput = h('input', {
        type: 'file', accept: '.json,application/json',
        style: { display: 'none' },
      });
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        try {
          const payload = JSON.parse(await file.text());
          const data = payload.data || payload;
          if (!confirm('导入会覆盖本机现在的对话，继续吗？')) return;
          await ctx.vault.importAll(data, { merge: false });
          toast('导入完成，正在重载');
          setTimeout(() => location.reload(), 600);
        } catch (err) {
          console.error(err);
          toast('这个文件读不出来');
        }
      });

      return h('div', { class: 'group' },
        h('h2', {}, '数据'),
        h('button', {
          class: 'btn',
          onclick: () => ctx.ui.sheet({
            title: '弹窗试一下',
            content: '这是内核基线的底部抽屉。装上「弹窗」模块后，可以在上面的「弹窗」分组里换方向。点空白处或按 Esc 关闭。',
          }),
        }, '弹窗试一下'),
        h('button', {
          class: 'btn',
          onclick: async () => {
            const payload = {
              format: 'xiaoshouji-backup',
              version: 1,
              at: new Date().toISOString(),
              characters: ctx.settings.get('characters', []),
              data: await ctx.vault.exportAll(),
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = h('a', { href: url, download: `xiaoshouji-${Date.now()}.json` });
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            toast('已导出');
          },
        }, '导出备份'),
        h('button', { class: 'btn', onclick: () => fileInput.click() }, '导入备份'),
        h('button', {
          class: 'btn',
          onclick: () => {
            const built = ctx.prompt.lastBuild();
            dump.style.display = dump.style.display === 'none' ? 'block' : 'none';
            dump.textContent = built
              ? `总预算 ${built.budget} 字，用了 ${built.used} 字\n\n`
                + built.parts.map((p) => `【${p.id}】${p.truncated ? '（已截断）' : ''}\n${p.text}`).join('\n\n')
              : '还没聊过，没有可看的内容';
          },
        }, '查看提示词拼装'),
        dump,
        h('button', {
          class: 'btn danger',
          onclick: async () => {
            if (!confirm('会删掉本机所有对话和设置，确定吗？')) return;
            await ctx.vault.clearAll();
            toast('已清空');
            setTimeout(() => location.reload(), 600);
          },
        }, '清空本机数据'),
        fileInput);
    }
  },
};
