import { router } from '../router';
import { createElement, clearElement } from '../utils/dom';
import { getDayInfo } from '../almanac/lunar';
import { getDayYiJi } from '../almanac/yiji';
import { getShiChenTable, ShiChenEntry } from '../almanac/shichen';
import { getFarmTipByDate } from '../almanac/farm';
import { WEEK_DAYS, PENG_ZU_TIAN, PENG_ZU_DI, XIU } from '../almanac/constants';
import { gregorianToJDN, addDays, formatDate } from '../utils/date';

export function renderDayDetail(app: HTMLElement, dateStr: string) {
  clearElement(app);
  app.className = 'page day-detail-page';

  const [year, month, day] = dateStr.split('-').map(Number);
  const info = getDayInfo(year, month, day);
  const yiJi = getDayYiJi(year, month, day);
  const shiChenTable = getShiChenTable(year, month, day);
  const lunar = info.lunar;
  const jdn = gregorianToJDN(year, month, day);

  const [py, pm, pd] = addDays(year, month, day, -1);
  const [ny, nm, nd] = addDays(year, month, day, 1);
  const prevDate = formatDate(py, pm, pd);
  const nextDate = formatDate(ny, nm, nd);

  // 头部
  const header = createElement('div', 'detail-header');
  const backBtn = createElement('button', 'back-btn', '◀ 返回');
  backBtn.addEventListener('click', () => router.navigate('/'));
  const dateTitle = createElement('h2', 'date-title', `${year}年${month}月${day}日`);
  const weekText = createElement('div', 'week-text', `星期${WEEK_DAYS[info.weekDay]}`);
  const dayNav = createElement('div', 'day-nav');
  const prevBtn = createElement('button', 'nav-btn', `前一天 ${pm}/${pd}`);
  prevBtn.addEventListener('click', () => router.navigate(`/day/${prevDate}`));
  const nextBtn = createElement('button', 'nav-btn', `后一天 ${nm}/${nd} ▶`);
  nextBtn.addEventListener('click', () => router.navigate(`/day/${nextDate}`));
  dayNav.append(prevBtn, nextBtn);
  header.append(backBtn, dateTitle, weekText, dayNav);

  // 农历信息卡片
  const lunarCard = createElement('div', 'card lunar-card');
  lunarCard.innerHTML = `
    <div class="lunar-main">
      <div class="lunar-date">${lunar.monthName}${lunar.dayName}</div>
      <div class="ganzhi">
        <span>${lunar.yearGanZhi}年</span>
        <span>${lunar.monthGanZhi}月</span>
        <span>${lunar.dayGanZhi}日</span>
      </div>
      <div class="shengxiao">生肖：${lunar.shengxiao}</div>
      ${lunar.solarTerm ? `<div class="solar-term-badge">${lunar.solarTerm}</div>` : ''}
    </div>
  `;

  // 宜忌卡片
  const yijiCard = createElement('div', 'card yiji-card');
  const yiList = yiJi.yi.slice(0, 8).map(y => `<span class="yi-tag">${y}</span>`).join('');
  const jiList = yiJi.ji.slice(0, 8).map(j => `<span class="ji-tag">${j}</span>`).join('');
  yijiCard.innerHTML = `
    <h3>今日宜忌</h3>
    <div class="yiji-row">
      <div class="yiji-col yi">
        <div class="yiji-label">宜</div>
        <div class="yiji-tags">${yiList || '<span class="empty-tag">无</span>'}</div>
      </div>
      <div class="yiji-col ji">
        <div class="yiji-label">忌</div>
        <div class="yiji-tags">${jiList || '<span class="empty-tag">无</span>'}</div>
      </div>
    </div>
    <div class="yiji-meta">
      <span>建星：${yiJi.jianXing}</span>
      <span>值神：${yiJi.zhiShen}</span>
      <span>冲${yiJi.chong}（${yiJi.chongShengxiao}）煞${yiJi.sha}</span>
    </div>
  `;

  // 今日最吉 / 最凶时辰摘要
  const extremeCard = createElement('div', 'card extreme-card');
  extremeCard.appendChild(renderExtreme('best', shiChenTable.best));
  extremeCard.appendChild(renderExtreme('worst', shiChenTable.worst));

  // 时辰吉凶
  const hourCard = createElement('div', 'card hour-card');
  hourCard.innerHTML = `
    <h3>时辰吉凶</h3>
    <div class="hour-card-meta">
      <span>今日日柱 <b>${shiChenTable.dayGanZhi}</b></span>
      <span>次日日柱 <b>${shiChenTable.nextDayGanZhi}</b></span>
      <span class="legend"><i class="dot clash-dot"></i>与时辰归属日宜忌相冲</span>
    </div>
  `;
  const hourTable = createElement('div', 'hour-table');
  shiChenTable.hours.forEach(h => {
    hourTable.appendChild(renderHourRow(h, shiChenTable));
  });
  hourCard.appendChild(hourTable);
  const hourNote = createElement('div', 'hour-note');
  hourNote.innerHTML = `
    子时横跨午夜：<b>早子时</b>（00:00–01:00）属今日，按今日日柱${shiChenTable.dayGanZhi}起时柱；
    <b>晚子时</b>（23:00–24:00）属次日，已按次日日柱${shiChenTable.nextDayGanZhi}起时柱，与后一天的早子时首尾相接。
  `;
  hourCard.appendChild(hourNote);

  // 彭祖百忌
  const pengzuCard = createElement('div', 'card pengzu-card');
  const ganIndex = '甲乙丙丁戊己庚辛壬癸'.indexOf(lunar.dayGanZhi[0]);
  const zhiIndex = '子丑寅卯辰巳午未申酉戌亥'.indexOf(lunar.dayGanZhi[1]);
  pengzuCard.innerHTML = `
    <h3>彭祖百忌</h3>
    <div class="pengzu-item">${PENG_ZU_TIAN[ganIndex] || ''}</div>
    <div class="pengzu-item">${PENG_ZU_DI[zhiIndex] || ''}</div>
  `;

  // 农事提示
  const farmCard = createElement('div', 'card farm-card');
  const farmTip = getFarmTipByDate(year, month, day, lunar.solarTerm);
  if (farmTip) {
    farmCard.innerHTML = `
      <h3>农事提示 · ${farmTip.term}</h3>
      <div class="farm-hou">${farmTip.hou}</div>
      <div class="farm-tasks">
        ${farmTip.tasks.map(t => `<span class="task-tag">${t}</span>`).join('')}
      </div>
    `;
  } else {
    farmCard.innerHTML = '<h3>农事提示</h3><div class="farm-empty">本月暂无特定农事提示</div>';
  }

  // 二十八宿
  const xiuCard = createElement('div', 'card xiu-card');
  const xiuIndex = (jdn + 1) % 28;
  xiuCard.innerHTML = `
    <h3>二十八宿</h3>
    <div class="xiu-name">${XIU[xiuIndex]}宿</div>
  `;

  app.append(header, extremeCard, lunarCard, yijiCard, hourCard, pengzuCard, farmCard, xiuCard);
}

// 最吉 / 最凶摘要块
function renderExtreme(kind: 'best' | 'worst', h: ShiChenEntry): HTMLElement {
  const box = createElement('div', `extreme extreme-${kind}`);
  box.innerHTML = `
    <div class="extreme-title">${kind === 'best' ? '今日最吉' : '今日最凶'}</div>
    <div class="extreme-main">
      <span class="extreme-name">${h.name}</span>
      <span class="extreme-time">${h.range}</span>
      <span class="extreme-luck">${h.luck}·${h.spirit}</span>
    </div>
    <div class="extreme-gz">时柱 ${h.ganZhi} ｜ 冲${h.chongShengxiao}煞${h.sha}</div>
    <div class="extreme-tags">
      ${h.yi.slice(0, 3).map(y => `<span class="yi-tag">${y}</span>`).join('')}
      ${h.ji.slice(0, 3).map(j => `<span class="ji-tag">${j}</span>`).join('')}
    </div>
  `;
  return box;
}

// 单个时辰行
function renderHourRow(h: ShiChenEntry, table: { best: ShiChenEntry; worst: ShiChenEntry }): HTMLElement {
  const isBest = table.best === h;
  const isWorst = table.worst === h;
  const rowClass = [
    'hour-row',
    h.luck,
    h.dayOffset === 1 ? 'next-day' : '',
    isBest ? 'is-best' : '',
    isWorst ? 'is-worst' : ''
  ].filter(Boolean).join(' ');
  const row = createElement('div', rowClass);

  const yiTags = h.yi.map(y => {
    const clash = h.yiClashWithDayJi.includes(y) ? ' clash' : '';
    return `<span class="hour-yi-tag${clash}"${clash ? ` title="时辰宜「${y}」，但当日忌之"` : ''}>${y}${clash ? ' ⚠' : ''}</span>`;
  }).join('');
  const jiTags = h.ji.map(j => {
    const clash = h.jiClashWithDayYi.includes(j) ? ' clash' : '';
    return `<span class="hour-ji-tag${clash}"${clash ? ` title="时辰忌「${j}」，但当日宜之"` : ''}>${j}${clash ? ' ⚠' : ''}</span>`;
  }).join('');

  const crown = isBest ? '<span class="crown best-crown">最吉</span>' : isWorst ? '<span class="crown worst-crown">最凶</span>' : '';

  row.innerHTML = `
    <div class="hour-head">
      <span class="hour-name">${crown}${h.name}</span>
      <span class="hour-range">${h.range}</span>
      <span class="hour-luck">${h.luck}·${h.spirit}</span>
      <span class="hour-belong">${h.dayOffset === 1 ? h.belongsLabel : ''}</span>
    </div>
    <div class="hour-body">
      <span class="hour-ganzhi">时柱 ${h.ganZhi}</span>
      <span class="hour-chong">冲${h.chongShengxiao}</span>
      <span class="hour-sha">煞${h.sha}</span>
      <span class="hour-yiji">
        <span class="hour-yiji-group yi">宜 ${yiTags}</span>
        <span class="hour-yiji-group ji">忌 ${jiTags}</span>
      </span>
    </div>
  `;
  return row;
}
