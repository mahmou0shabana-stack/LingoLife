/**
 * LingoLife — مشغّل اختبارات صغير
 *
 * بلا أي اعتماديات، ويعمل داخل متصفح حقيقي — لأن ما نختبره هنا
 * (IndexedDB، Blob، crypto.subtle، ZIP) لا يوجد له بديل مقنع خارج المتصفح.
 */

const suites = [];
let current = null;

export function describe(name, fn) {
  current = { name, tests: [] };
  suites.push(current);
  fn();
  current = null;
}

export function it(name, fn) {
  if (!current) throw new Error('it() خارج describe()');
  current.tests.push({ name, fn });
}

export function expect(actual) {
  return {
    toBe(expected) {
      if (!Object.is(actual, expected)) {
        throw new Error(`متوقّع ${JSON.stringify(expected)} ووُجد ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) throw new Error(`متوقّع ${b}\nووُجد ${a}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(`متوقّع قيمة صادقة ووُجد ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`متوقّع قيمة كاذبة ووُجد ${JSON.stringify(actual)}`);
    },
    toContain(needle) {
      if (!String(actual).includes(needle)) {
        throw new Error(`متوقّع أن يحتوي على "${needle}" — ووُجد "${actual}"`);
      }
    },
    toHaveLength(n) {
      if (actual?.length !== n) {
        throw new Error(`متوقّع طول ${n} ووُجد ${actual?.length}`);
      }
    },
    async toReject(match) {
      try {
        await actual;
      } catch (error) {
        if (match && !String(error.message).includes(match)) {
          throw new Error(`رُفض برسالة غير متوقّعة: ${error.message}`);
        }
        return;
      }
      throw new Error('متوقّع رفضًا ولم يحدث');
    },
  };
}

/** يشغّل كل المجموعات ويعيد النتيجة. */
export async function run(onEvent = () => {}) {
  const results = [];
  let passed = 0;
  let failed = 0;

  for (const suite of suites) {
    onEvent({ type: 'suite', name: suite.name });
    for (const test of suite.tests) {
      const started = performance.now();
      try {
        await test.fn();
        const ms = Math.round(performance.now() - started);
        passed++;
        results.push({ suite: suite.name, name: test.name, ok: true, ms });
        onEvent({ type: 'pass', suite: suite.name, name: test.name, ms });
      } catch (error) {
        const ms = Math.round(performance.now() - started);
        failed++;
        results.push({
          suite: suite.name,
          name: test.name,
          ok: false,
          ms,
          error: error.message,
          stack: error.stack,
        });
        onEvent({ type: 'fail', suite: suite.name, name: test.name, ms, error: error.message });
      }
    }
  }

  return { passed, failed, total: passed + failed, results };
}
