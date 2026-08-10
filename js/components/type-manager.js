/**
 * LingoLife — إدارة أنواع الذكريات
 *
 * لوحة مستقلّة (لا `showModal`) لأنها ليست نموذجًا يُملأ ويُرسَل، بل
 * مساحة تتصرّف فيها: تضيف، تفرّع، تعدّل، تؤرشف، تدمج — كل عملية تحفظ
 * فورًا وتُعيد رسم القائمة.
 *
 * المبدأ الحاكم: **لا حذف نهائيًّا لنوع مستعمَل.** الأرشفة تُخفيه من
 * قوائم الاختيار وتُبقي مشاهده سليمة. والدمج ينقل المشاهد أولًا ثم
 * يؤرشف — فلا تفقد شيئًا في الطريق.
 */

import { esc } from '../utils/dom.js';
import { icon } from './icons.js';
import { toast, toastOk, toastError } from './toast.js';
import { confirmAction, showModal, registerOverlay, isTopOverlay } from './modal.js';
import {
  typeTree,
  listTypes,
  addType,
  updateType,
  archiveType,
  mergeInto,
  usageCount,
  usageCounts,
  renameImpact,
  similarTypes,
} from '../services/type-service.js';

/**
 * يفتح لوحة الأنواع.
 * @returns {Promise<boolean>} هل تغيّر شيء؟ (ليعيد النداء رسم منتقي النوع)
 */
export function openTypeManager({ focusId = null } = {}) {
  return new Promise((resolve) => {
    let changed = false;
    /** معرّف النوع المفتوح للتعديل، أو `new:<parentId>` لصفّ إضافة فرع. */
    let editing = focusId ? `new:${focusId}` : null;
    let showArchived = false;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="modal type-manager" role="dialog" aria-modal="true" aria-label="أنواع الذكريات">
        <h2>أنواع الذكريات</h2>
        <p class="tm-hint">
          النوع بيوصف حدثًا من حياتك، مش خانة تصنيف. تقدر تضيف نوع جديد،
          أو تفرّع نوع موجود — «فحص» يتفرّع لـ«فحص داخلي» و«فحص في الموقع».
        </p>
        <div class="tm-list" data-list></div>
        <form class="tm-add" data-add-root>
          <input type="text" name="label" placeholder="نوع جديد… مثلًا: تسليم شحنة"
                 maxlength="40" autocomplete="off" />
          <button type="submit" class="btn btn-primary btn-sm">${icon('plus', 15)} أضف</button>
        </form>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-similar>شوف المكرَّر</button>
          <button type="button" class="btn btn-ghost" data-toggle-archived></button>
          <button type="button" class="btn btn-primary" data-close>تمام</button>
        </div>
      </div>`;

    const listHost = overlay.querySelector('[data-list]');
    const archivedButton = overlay.querySelector('[data-toggle-archived]');

    let unregister = () => {};

    const finish = () => {
      document.removeEventListener('keydown', onKey);
      unregister();
      overlay.remove();
      resolve(changed);
    };

    const onKey = (event) => {
      if (event.key !== 'Escape' || !isTopOverlay(overlay)) return;
      // Escape يُلغي التعديل الجاري أولًا، ثم يغلق اللوحة — فلا تفقد
      // اللوحة كلها لأنك تراجعت عن سطر واحد.
      if (editing) {
        editing = null;
        render();
      } else finish();
    };

    /* ---------- الرسم ---------- */

    function typeRow(type, { depth = 0, counts }) {
      const used = counts.get(type.id) || 0;
      const isEditing = editing === type.id;

      if (isEditing) {
        return `
          <form class="tm-row tm-row-edit" data-edit="${type.id}" style="--depth:${depth}">
            <input type="text" name="label" value="${esc(type.label)}" maxlength="40"
                   autocomplete="off" data-autofocus />
            <button type="submit" class="btn btn-primary btn-sm">${icon('check', 15)}</button>
            <button type="button" class="btn btn-ghost btn-sm" data-cancel>إلغاء</button>
          </form>`;
      }

      const meta = used ? `<span class="tm-count">${used} ذكرى</span>` : '';
      const archived = type.archived
        ? `<button type="button" class="tm-icon" data-restore="${type.id}" title="رجّعه">
             ${icon('restore', 16)}</button>`
        : `<button type="button" class="tm-icon" data-archive="${type.id}" title="أرشفة">
             ${icon('trash', 16)}</button>`;

      // الفروع لا تتفرّع: مستويان يكفيان لوصف حدث، وأكثر منهما يتحوّل
      // إلى شجرة تُدار بدل أن تخدم.
      const branch =
        depth === 0 && !type.archived
          ? `<button type="button" class="tm-icon" data-sub="${type.id}" title="أضف فرع">
               ${icon('plus', 16)}</button>`
          : '';

      return `
        <div class="tm-row${type.archived ? ' is-archived' : ''}" style="--depth:${depth}">
          <span class="tm-label">${depth ? '<span class="tm-branch">↳</span> ' : ''}${esc(type.label)}</span>
          ${meta}
          <span class="tm-tools">
            ${branch}
            <button type="button" class="tm-icon" data-edit-start="${type.id}" title="عدّل">
              ${icon('edit', 16)}</button>
            ${used ? `<button type="button" class="tm-icon" data-merge="${type.id}" title="ادمج في نوع تاني">${icon('compare', 16)}</button>` : ''}
            ${archived}
          </span>
        </div>`;
    }

    function addRow(parentId) {
      return `
        <form class="tm-row tm-row-edit" data-add-child="${parentId}" style="--depth:1">
          <input type="text" name="label" placeholder="اسم الفرع…" maxlength="40"
                 autocomplete="off" data-autofocus />
          <button type="submit" class="btn btn-primary btn-sm">${icon('check', 15)}</button>
          <button type="button" class="btn btn-ghost btn-sm" data-cancel>إلغاء</button>
        </form>`;
    }

    async function render() {
      const tree = await typeTree({ includeArchived: showArchived });
      const counts = await usageCounts();

      listHost.innerHTML = tree
        .map((root) => {
          const kids = root.children.map((c) => typeRow(c, { depth: 1, counts })).join('');
          const pending = editing === `new:${root.id}` ? addRow(root.id) : '';
          return typeRow(root, { depth: 0, counts }) + kids + pending;
        })
        .join('');

      archivedButton.textContent = showArchived ? 'إخفاء المؤرشف' : 'إظهار المؤرشف';
      overlay.querySelector('[data-autofocus]')?.focus();
    }

    /* ---------- العمليات ---------- */

    /**
     * يشغّل عملية ويعرض خطأها كإشعار بدل أن يبتلعه.
     * @returns {Promise<boolean>} هل نجحت؟ — لينبني عليها ما بعدها.
     */
    async function run(fn, okMessage) {
      try {
        await fn();
        changed = true;
        if (okMessage) toastOk(okMessage);
        await render();
        return true;
      } catch (err) {
        toastError(err.message || 'حصلت مشكلة');
        return false;
      }
    }

    async function openMerge(fromId) {
      const all = await listTypes({ includeArchived: false });
      const from = all.find((t) => t.id === fromId);
      const others = all.filter((t) => t.id !== fromId && t.parentId !== fromId);
      if (!others.length) {
        toast('مفيش نوع تاني تدمج فيه.');
        return;
      }

      const used = await usageCount(fromId);
      let target = null;

      const value = await showModal({
        title: `ادمج «${from.label}»`,
        submitLabel: 'ادمج',
        body: `
          <p class="tm-hint">
            كل الـ${used} ذكرى اللي نوعها «${esc(from.label)}» هيتحوّلوا للنوع اللي
            تختاره، وبعدين «${esc(from.label)}» يتأرشف. مفيش ذكرى بتضيع.
          </p>
          <div class="field">
            <label for="tm-merge-into">ادمج في</label>
            <select id="tm-merge-into" name="into">
              ${others
                .map(
                  (t) =>
                    `<option value="${t.id}">${esc(t.parentId ? `${all.find((p) => p.id === t.parentId)?.label || ''} › ${t.label}` : t.label)}</option>`
                )
                .join('')}
            </select>
          </div>`,
        // القراءة داخل `onSubmit`: النافذة تُزال من الـDOM عند الإغلاق،
        // فالقراءة بعده ترجع فاضي.
        onSubmit: (data, close) => {
          target = data.into;
          close();
        },
      });

      if (value !== 'submit' || !target) return;
      await run(async () => {
        const moved = await mergeInto(fromId, target);
        toastOk(`اتنقلت ${moved} ذكرى.`);
      });
    }

    /**
     * إعادة التسمية عامّة بطبيعتها — لكن ليست صامتة (بند 10).
     *
     * الذكرى تحمل **معرّف** النوع لا اسمه، فتغيير الاسم يظهر فورًا في
     * كل ذكرى تستعمله. وهذا هو المطلوب غالبًا، لكنه ليس بديهيًّا: أن
     * تعدّل «فحص» فتجد سبعًا وعشرين ذكرى تبدّلت دفعةً واحدة مفاجأةٌ لا
     * ميزة. فنقول العدد ونعرض المخرج الثالث قبل الفعل.
     */
    async function askRename(id, label) {
      const impact = await renameImpact(id, label);

      // لا تبعة تُذكَر: لا نُقحم نافذةً بين يدك والنتيجة.
      if (impact.from === impact.to) {
        editing = null;
        return void render();
      }
      if (!impact.scenes) {
        return void run(async () => {
          await updateType(id, { label });
          editing = null;
        }, 'اتعدّل.');
      }

      let choice = null;
      const value = await showModal({
        title: `«${impact.from}» ← «${impact.to}»`,
        submitLabel: 'نفّذ',
        body: `
          <p class="tm-hint">
            النوع ده مستعمَل في <strong>${impact.scenes} ذكرى</strong>${
              impact.children ? ` وتحته ${impact.children} فرع` : ''
            }. الاسم الجديد هيظهر فيها كلها — الذكريات بتحمل النوع نفسه
            مش اسمه، فمفيش حاجة بتضيع.
          </p>
          <div class="field">
            <label>
              <input type="radio" name="mode" value="rename" checked />
              حدّث الاسم في الكل — ${impact.scenes} ذكرى
            </label>
            <label>
              <input type="radio" name="mode" value="new" />
              سيب «${esc(impact.from)}» زي ما هو، واعمل نوع جديد اسمه
              «${esc(impact.to)}»
            </label>
          </div>`,
        onSubmit: (data, close) => {
          choice = data.mode;
          close();
        },
      });
      if (value !== 'submit' || !choice) return;

      await run(async () => {
        if (choice === 'new') {
          const parent = (await listTypes({ includeArchived: true })).find((t) => t.id === id);
          await addType({ label, parentId: parent?.parentId || null });
        } else {
          await updateType(id, { label });
        }
        editing = null;
      }, choice === 'new' ? `عملنا «${label}» نوعًا جديدًا.` : `اتعدّل في ${impact.scenes} ذكرى.`);
    }

    /**
     * أنواعٌ تبدو واحدًا مكرَّرًا (بند 11).
     *
     * ⚠️ **اقتراحٌ لا دمج تلقائي.** «فحص داخلي» و«فحص خارجي» متشابهان
     *    نصًّا ومختلفان تمامًا معنًى — والآلة لا تعرف الفرق وأنت تعرفه.
     *    فالزرّ هنا يفتح الدمج ولا يفعله.
     */
    async function openSimilar() {
      const pairs = await similarTypes();
      if (!pairs.length) {
        toast('مفيش أنواع مكرّرة — كله واضح.');
        return;
      }

      let picked = null;
      const value = await showModal({
        title: 'أنواع شبه بعضها',
        submitLabel: 'ادمج المختار',
        body: `
          <p class="tm-hint">
            دول أنواع أسماؤها قريبة من بعض. ممكن يكونوا نفس الحاجة
            مكرَّرة، وممكن يكونوا حاجتين مختلفتين فعلًا —
            <strong>إنت اللي تقرّر</strong>، إحنا بنعرض بس.
          </p>
          <div class="field">
            ${pairs
              .map(
                (p, i) => `
                <label>
                  <input type="radio" name="pair" value="${i}" ${i === 0 ? 'checked' : ''} />
                  «${esc(p.a.label)}» و«${esc(p.b.label)}»
                  <span class="tm-count">${esc(p.reason)}</span>
                </label>`
              )
              .join('')}
          </div>`,
        onSubmit: (data, close) => {
          picked = pairs[Number(data.pair)];
          close();
        },
      });
      if (value !== 'submit' || !picked) return;

      // نفتح شاشة الدمج المعتادة: هي التي تعرض العدد وتسأل عن الاتجاه.
      await openMerge(picked.a.id);
    }

    async function askArchive(id) {
      const all = await listTypes({ includeArchived: true });
      const type = all.find((t) => t.id === id);
      const used = await usageCount(id);

      const ok = await confirmAction({
        title: `أرشفة «${type.label}»؟`,
        message: used
          ? `فيه ${used} ذكرى بالنوع ده. الأرشفة بتخفيه من قوايم الاختيار بس، والذكريات بتفضل زي ما هي بنوعها. تقدر ترجّعه في أي وقت.`
          : 'هيختفي من قوايم الاختيار. تقدر ترجّعه في أي وقت من «إظهار المؤرشف».',
        confirmLabel: 'أرشِف',
        danger: true,
      });
      if (!ok) return;

      if (!(await run(async () => archiveType(id, true)))) return;

      // رسالة الاستعادة بعد التنفيذ — الأرشفة قرار قابل للرجوع.
      toast(`أرشفنا «${type.label}».`, {
        actionLabel: 'تراجع',
        onAction: () => run(async () => archiveType(id, false), 'تمّ التراجع.'),
      });
    }

    /* ---------- الأحداث ---------- */

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        finish();
        return;
      }

      const button = event.target.closest('button');
      if (!button || !overlay.contains(button)) return;

      if (button.hasAttribute('data-close')) return finish();

      if (button.hasAttribute('data-toggle-archived')) {
        showArchived = !showArchived;
        return void render();
      }
      if (button.hasAttribute('data-cancel')) {
        editing = null;
        return void render();
      }
      if (button.dataset.editStart) {
        editing = button.dataset.editStart;
        return void render();
      }
      if (button.dataset.sub) {
        editing = `new:${button.dataset.sub}`;
        return void render();
      }
      if (button.dataset.archive) return void askArchive(button.dataset.archive);
      if (button.dataset.restore) {
        return void run(async () => archiveType(button.dataset.restore, false), 'رجّعناه.');
      }
      if (button.hasAttribute('data-similar')) return void openSimilar();
      if (button.dataset.merge) return void openMerge(button.dataset.merge);
    });

    overlay.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.target;
      const label = new FormData(form).get('label')?.trim();
      if (!label) return;

      if (form.hasAttribute('data-add-root')) {
        return void run(async () => {
          await addType({ label, parentId: null });
          form.reset();
        }, `ضفنا «${label}».`);
      }
      if (form.dataset.addChild) {
        const parentId = form.dataset.addChild;
        return void run(async () => {
          await addType({ label, parentId });
          editing = null;
        }, `ضفنا «${label}» كفرع.`);
      }
      if (form.dataset.edit) {
        return void askRename(form.dataset.edit, label);
      }
    });

    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    unregister = registerOverlay(overlay);
    render();
  });
}
