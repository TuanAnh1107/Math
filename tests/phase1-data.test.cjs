require('./load-ts.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { curriculumChapters, getAdminTableData } = require('../src/sampleData.ts');

test('F04: searching a third lesson preserves its original identity, number and status', () => {
  const chapter = curriculumChapters.find(chapter => chapter.id === 'chapter-02');
  const original = chapter.lessons[2];
  const found = chapter.lessons.filter(lesson => lesson.title.includes('Đồ thị'));
  assert.equal(found.length, 1);
  assert.strictEqual(found[0], original);
  assert.deepEqual([found[0].id, found[0].number, found[0].status, chapter.progress],
    ['lesson-02-03', 3, 'Chưa học', 72]);
  assert.equal(found.filter(lesson => lesson.status === 'Hoàn thành').length, 0);
  assert.equal(chapter.lessons.length, 3);
});

test('F04: duplicate lesson titles in different chapters still have distinct IDs', () => {
  const allLessons = curriculumChapters.flatMap(chapter => chapter.lessons);
  assert.equal(new Set(allLessons.map(lesson => lesson.id)).size, allLessons.length);
});

test('F05: searching a student preserves ID, percentage, group and draft status', () => {
  for (const page of ['Học sinh', 'Nhóm học sinh', 'Kết quả']) {
    const table = getAdminTableData(page);
    const row = table.rows.filter(row => row.title.includes('Thanh Hà'))[0];
    assert.strictEqual(row, table.rows[3]);
    assert.deepEqual([row.id, row.subtitle, row.value, row.groupOrTopic, row.status],
      ['hs004', 'hs004', '54%', '9A1', 'Bản nháp']);
  }
});

test('F05: searching a question preserves its original topic and difficulty', () => {
  const table = getAdminTableData('Câu hỏi');
  const row = table.rows.filter(row => row.title.includes('Rút gọn'))[0];
  assert.strictEqual(row, table.rows[3]);
  assert.deepEqual([row.id, row.groupOrTopic, row.value, row.status],
    ['CH-004', 'Căn thức', 'Nâng cao', 'Bản nháp']);
});

test('F05: all admin sample tables retain stable IDs when filtering to the last row', () => {
  for (const page of ['Chương trình', 'Bài học', 'Đề kiểm tra', 'Phòng thi']) {
    const table = getAdminTableData(page);
    const original = table.rows[table.rows.length - 1];
    const filtered = table.rows.filter(row => row.title === original.title);
    assert.strictEqual(filtered[0], original);
    assert.equal(filtered[0].value, 16);
    assert.equal(filtered[0].status, 'Bản nháp');
    assert.equal(new Set(table.rows.map(row => row.id)).size, table.rows.length);
  }
});
