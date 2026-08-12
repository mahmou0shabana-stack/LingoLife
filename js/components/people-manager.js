/**
 * LingoLife — مكتبة الأشخاص
 *
 * قالبها هو `type-manager.js` نفسه: صفوفٌ + تعديل داخل السطر + أرشفة
 * + عدّ استعمال. تكرار النمط مقصود — مَن يعرف أحدهما يعرف الآخر.
 *
 * وفيها ما ليس في مدير الأنواع: **قائمة المتحدّثين الذين لا شخص لهم**.
 * كل اسمٍ حرٍّ كتبتَه في محادثة يظهر هنا بعدد أجزائه ومشاهده، ومعه
 * اقتراحٌ إن وُجد — **اقتراح لا فعل**. الربط الصامت يخلط كلام رجلين،
 * وهو خطأ لا يُكتشَف بعد شهر.
 */

import { esc } from '../utils/dom.js';
import { icon } from './icons.js';
import { toast, toastOk, toastError } from './toast.js';
import { confirmAction, showModal, registerOverlay, isTopOverlay } from './modal.js';
import {
  PERSON_ROLES,
  listPeople,
  addPerson,
  updatePerson,
  archivePerson,
  speakingCounts,
  unlinkedSpeakers,
  linkSpeakerTo,
} from '../services/person-service.js';

/**
 * يفتح مكتبة الأشخاص.
 * @returns {Promise<boolean>} هل تغيّر شيء؟
 */
export function openPeopleManager() {
  return new Promise((resolve) => {
    let changed = false;
    let editing = null;
    let showArchived = false;

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `
      <div class="modal type-manager" role="dialog" aria-modal="true" aria-label="الأشخاص">
        <h2>الأشخاص</h2>
        <p class="tm-hint">
          مين اللي بتتكلّم معاهم. لمّا يبقى الشخص معروف، تقدر تسأل
          «فين كل الكلام اللي قاله؟» — وده سؤال مفيش ليه إجابة وإنت
          بتكتب الاسم نصًّا كل مرّة.
        </p>
        <div class="tm-list" data-list></div>
        <div data-unlinked></div>
        <form class="tm-add" data-add-person>
          <input type="text" name="name" placeholder="شخص جديد… مثلًا Алексей"
                 maxlength="120" autocomplete="off" />
          <button type="submit" class="btn btn-primary btn-sm">${icon('plus', 15)} أضف</button>
        </form>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-toggle-archived></button>
          <button type="button" class="btn btn-primary" data-close>تمام</button>
        </div>
      </div>`;

    const listHost = overlay.querySelector('[data-list]');
    const unlinkedHost = overlay.querySelector('[data-unlinked]');
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
      if (editing) {
        editing = null;
        render();
      } else finish();
    };

    /* ---------- الرسم ---------- */

    function personRow(person, counts) {
      const said = counts.get(person.id) || 0;

      if (editing === person.id) {
        return `
          <form class="tm-row tm-row-edit person-edit" data-edit="${person.id}">
            <input type="text" name="name" value="${esc(person.name)}" maxlength="120"
                   placeholder="الاسم" autocomplete="off" data-autofocus />
            <input type="text" name="nameRu" value="${esc(person.nameRu)}" maxlength="120"
                   placeholder="بالروسي" dir="ltr" lang="ru" autocomplete="off" />
            <input type="text" name="role" value="${esc(person.role)}" maxlength="120"
                   placeholder="الدور" list="person-roles" autocomplete="off" />
            <button type="submit" class="btn btn-primary btn-sm">${icon('check', 15)}</button>
            <button type="button" class="btn btn-ghost btn-sm" data-cancel>إلغاء</button>
          </form>`;
      }

      const meta = said ? `<span class="tm-count">${said} جملة</span>` : '';
      const sub = [person.nameRu, person.role, person.company].filter(Boolean).join(' · ');

      return `
        <div class="tm-row person-row${person.archived ? ' is-archived' : ''}">
          <span class="person-dot" style="background:${esc(person.color || '#8B5CF6')}"></span>
          <span class="tm-label">
            ${esc(person.name)}
            ${sub ? `<small class="person-sub">${esc(sub)}</small>` : ''}
          </span>
          ${meta}
          <span class="tm-tools">
            <button type="button" class="tm-icon" data-edit-start="${person.id}" title="عدّل">
              ${icon('edit', 16)}</button>
            ${
              person.archived
                ? `<button type="button" class="tm-icon" data-restore="${person.id}" title="رجّعه">${icon('restore', 16)}</button>`
                : `<button type="button" class="tm-icon" data-archive="${person.id}" title="أرشفة">${icon('trash', 16)}</button>`
            }
          </span>
        </div>`;
    }

    /**
     * المتحدّثون الذين لا شخص لهم.
     *
     * ⚠️ يُعرَضون ولا يُربَطون. والزرّ يقول ما سيفعله بالضبط وبكم جزء
     *    — «اربط الـ7 دول بأليكسي» لا «اربط».
     */
    function unlinkedBlock(rows, people) {
      if (!rows.length) return '';

      const options = people
        .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
        .join('');

      return `
        <div class="pm-unlinked">
          <h3>${icon('info', 15)} متحدّثون لسه بأسماء مكتوبة</h3>
          <p class="tm-hint">
            دول أسماء كتبتها في المحادثات ولسه مش مربوطة بشخص. الربط
            <strong>قرارك إنت</strong> — «أليكسي» و«Алексей» ممكن يكونوا
            واحد وممكن يكونوا اتنين، وإحنا مش هنخمّن.
          </p>
          ${rows
            .map(
              (row, i) => `
              <div class="pm-unlinked-row">
                <span class="tm-label">${esc(row.speaker)}</span>
                <span class="tm-count">${row.parts} جملة · ${row.scenes} ذكرى</span>
                ${
                  row.suggestion
                    ? `<button type="button" class="btn btn-ghost btn-sm"
                         data-link-speaker="${i}" data-person="${row.suggestion.person.id}">
                         اربطهم بـ«${esc(row.suggestion.person.name)}»
                       </button>`
                    : people.length
                      ? `<select data-link-pick="${i}">
                           <option value="">اربطه بـ…</option>${options}
                         </select>`
                      : `<button type="button" class="btn btn-ghost btn-sm" data-make-person="${i}">
                           اعمله شخص
                         </button>`
                }
              </div>`
            )
            .join('')}
        </div>`;
    }

    /** الصفّ المعروض حاليًّا — تحتاجه أزرار الربط لتعرف الاسم. */
    let unlinkedRows = [];

    async function render() {
      const [people, counts, unlinked] = await Promise.all([
        listPeople({ includeArchived: showArchived }),
        speakingCounts(),
        unlinkedSpeakers(),
      ]);
      unlinkedRows = unlinked;

      listHost.innerHTML = people.length
        ? people.map((p) => personRow(p, counts)).join('')
        : `<p class="tm-hint">لسه مفيش حد. اكتب اسمًا تحت، أو اربط واحدًا من اللي فوق.</p>`;

      /*
       * ⚠️ **الأدوار تتعلّم منك** *(A8)*. كانت القائمة ثابتةً في الكود
       *    وحدها، فتكتب «مدير المخزن» عشر مرّات ولا تُقترَح عليك في
       *    الحادية عشرة. فما كتبتَه بنفسك يُضمّ إليها — **ويسبقها**،
       *    لأنه أقربُ إلى ما ستكتبه الآن.
       *
       * ⚠️ ويُملأ هنا لا عند الفتح: عند الفتح لم يكن أحدٌ قد قُرئ بعد.
       */
      const mine = [...new Set(
        people.map((row) => String(row.role || '').trim()).filter(Boolean)
      )].filter((role) => !PERSON_ROLES.includes(role));
      roles.innerHTML = [...mine, ...PERSON_ROLES]
        .map((r) => `<option value="${esc(r)}"></option>`).join('');

      unlinkedHost.innerHTML = unlinkedBlock(unlinked, people.filter((p) => !p.archived));
      archivedButton.textContent = showArchived ? 'إخفاء المؤرشف' : 'إظهار المؤرشف';
      overlay.querySelector('[data-autofocus]')?.focus();
    }

    /* ---------- العمليات ---------- */

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

    async function askArchive(id) {
      const person = (await listPeople({ includeArchived: true })).find((p) => p.id === id);
      const said = (await speakingCounts()).get(id) || 0;

      const ok = await confirmAction({
        title: `أرشفة «${person.name}»؟`,
        message: said
          ? `فيه ${said} جملة منسوبة ليه. الأرشفة بتخفيه من المنتقي بس، والكلام بيفضل منسوب ليه زي ما هو.`
          : 'هيختفي من المنتقي. تقدر ترجّعه في أي وقت.',
        confirmLabel: 'أرشِف',
        danger: true,
      });
      if (!ok) return;

      if (!(await run(async () => archivePerson(id, true)))) return;
      toast(`أرشفنا «${person.name}».`, {
        actionLabel: 'تراجع',
        onAction: () => run(async () => archivePerson(id, false), 'تمّ التراجع.'),
      });
    }

    /** يُنشئ شخصًا من اسمٍ حرّ ثم ينسب إليه كل أجزائه. */
    async function makePersonFrom(index) {
      const row = unlinkedRows[index];
      if (!row) return;
      await run(async () => {
        const person = await addPerson({ name: row.speaker });
        const moved = await linkSpeakerTo(row.speaker, person.id);
        toastOk(`عملنا «${person.name}» وربطنا ${moved} جملة بيه.`);
      });
    }

    async function linkTo(index, personId) {
      const row = unlinkedRows[index];
      if (!row || !personId) return;
      await run(async () => {
        const moved = await linkSpeakerTo(row.speaker, personId);
        toastOk(`ربطنا ${moved} جملة.`);
      });
    }

    /* ---------- الأحداث ---------- */

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) return finish();

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
      if (button.dataset.archive) return void askArchive(button.dataset.archive);
      if (button.dataset.restore) {
        return void run(async () => archivePerson(button.dataset.restore, false), 'رجّعناه.');
      }
      if (button.dataset.linkSpeaker !== undefined) {
        return void linkTo(Number(button.dataset.linkSpeaker), button.dataset.person);
      }
      if (button.dataset.makePerson !== undefined) {
        return void makePersonFrom(Number(button.dataset.makePerson));
      }
    });

    overlay.addEventListener('change', (event) => {
      const pick = event.target.closest('[data-link-pick]');
      if (!pick || !pick.value) return;
      linkTo(Number(pick.dataset.linkPick), pick.value);
    });

    overlay.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.target;
      const data = Object.fromEntries(new FormData(form).entries());

      if (form.hasAttribute('data-add-person')) {
        const name = (data.name || '').trim();
        if (!name) return;
        return void run(async () => {
          await addPerson({ name });
          form.reset();
        }, `ضفنا «${name}».`);
      }

      if (form.dataset.edit) {
        const id = form.dataset.edit;
        return void run(async () => {
          await updatePerson(id, {
            name: (data.name || '').trim(),
            nameRu: (data.nameRu || '').trim(),
            role: (data.role || '').trim(),
          });
          editing = null;
        }, 'اتعدّل.');
      }
    });

    // قائمة أدوار جاهزة — تُملأ في `render` لأنها تتعلّم ممّا كتبتَه.
    const roles = document.createElement('datalist');
    roles.id = 'person-roles';
    overlay.append(roles);

    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    unregister = registerOverlay(overlay);
    render();
  });
}
