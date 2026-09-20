import { router } from '../router';
import { createElement, clearElement } from '../utils/dom';
import { getDayInfo, getDayGanZhi } from '../almanac/lunar';
import { getDayYiJi } from '../almanac/yiji';
import { getDayShiChen } from '../almanac/shichen';
import { getFarmTipByDate } from '../almanac/farm';
import { WEEK_DAYS, PENG_ZU_TIAN, PENG_ZU_DI, XIU } from '../almanac/constants';
import { gregorianToJDN, jdnToGregorian, formatDate } from '../utils/date';
import type { ShiChenSlot, ShiChenTag } from '../almanac/shichen';

function dayLink(jdn: number): string {
  const [y, m, d] = jdnToGregorian(jdn);
  return `/day/${formatDate(y, m, d)}`;
}

function tagHtml(tag: ShiChenTag, kind: 'yi' | 'ji'): string {
  const warn = tag.state === 'conflict' ? ' ⚠相冲' : tag.state === 'match' ? ' ✓' : '';
  return `<span class="hour-tag ${kind} ${tag.state}">${tag.text}${warn}</span>`;
}

function hourRowHtml(h: ShiChenSlot, index: number, isBest: boolean, isWorst: boolean): string {
  const belong = h.ziFlag
    ? `<span class="hour-belong">属${h.belongDate[0]}-${String(h.belongDate[1]).padStart(2, '0')}-${String(h.belongDate[2]).padStart(2, '0')}</span>`
    : '';
  return `
    <div class="hour-row ${h.luck} ${h.ziFlag === '晚子时' ? 'wan-zi' : ''} ${isBest ? 'is-best' : ''} ${isWorst ? 'is-worst' : ''}" id="shichen-${index}">
      <div class="hour-head">
        <span class="hour-name">${h.ziFlag || h.name}</span>
        <span class="hour-range">${h.range}</span>
        <span class="hour-ganzhi">${h.ganZhi}</span>
        <span class="hour-shen">${h.shen}</span>
        <span class="hour-luck">${h.luck}</span>
        ${belong}
        ${isBest ? '<span class="hour-crown best-crown">最吉</span>' : ''}
        ${isWorst ? '<span class="hour-crown worst-crown">最凶</span>' : ''}
      </div>
      <div class="hour-yiji">
        <span class="hour-yiji-label yi">宜</span>
        <span class="hour-tags">${h.yi.map(t => tagHtml(t, 'yi')).join('')}</span>
      </div>
      <div class="hour-yiji">
        <span class="hour-yiji-label ji">忌</span>
        <span class="hour-tags">${h.ji.map(t => tagHtml(t, 'ji')).join('')}</span>
      </div>
      <div class="hour-chongsha">冲${h.chongShengxiao}（属${h.chongShengxiao}者此柱受冲） · 煞${h.sha}方</div>
    </div>
  `;
}

export function renderDayDetail(app: HTMLElement, dateStr: string) {
  clearElement(app);
  app.className = 'page day-detail-page';

  const [year, month, day] = dateStr.split('-').map(Number);
  const info = getDayInfo(year, month, day);
  const yiJi = getDayYiJi(year, month, day);
  const lunar = info.lunar;
  const jdn = gregorianToJDN(year, month, day);

  // 时辰总表（宜忌/冲煞/黄黑道/早晚子时），传入当天宜忌用于比对
  const shiChen = getDayShiChen(jdn, yiJi.yi, yiJi.ji);
  const bestIndex = shiChen.slots.indexOf(shiChen.best);
  const worstIndex = shiChen.slots.indexOf(shiChen.worst);

  // 头部
  const header = createElement('div', 'detail-header');
  const backBtn = createElement('button', 'back-btn', '◀ 返回');
  backBtn.addEventListener('click', () => router.navigate('/'));
  const dateTitle = createElement('h2', 'date-title', `${year}年${month}月${day}日`);
  const weekText = createElement('div', 'week-text', `星期${WEEK_DAYS[info.weekDay]}`);
  header.append(backBtn, dateTitle, weekText);

  // 前后日导航（显示相邻日柱，方便核对日柱相接、晚子时归属）
  const [py, pm, pd] = jdnToGregorian(jdn - 1);
  const [ny, nm, nd] = jdnToGregorian(jdn + 1);
  const prevDayGanZhi = getDayGanZhi(jdn - 1);
  const nav = createElement('div', 'day-nav');
  const prevLink = createElement('a', 'day-nav-link') as HTMLAnchorElement;
  const nextLink = createElement('a', 'day-nav-link') as HTMLAnchorElement;
  prevLink.href = dayLink(jdn - 1);
  nextLink.href = dayLink(jdn + 1);
  prevLink.textContent = `◀ ${py}-${String(pm).padStart(2, '0')}-${String(pd).padStart(2, '0')} ${prevDayGanZhi}日`;
  nextLink.textContent = `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')} ${shiChen.nextDayGanZhi}日 ▶`;
  prevLink.addEventListener('click', (e) => { e.preventDefault(); router.navigate(dayLink(jdn - 1)); });
  nextLink.addEventListener('click', (e) => { e.preventDefault(); router.navigate(dayLink(jdn + 1)); });
  nav.append(prevLink, nextLink);

  // 时辰择要：最吉 / 最凶 提到页头
  const summaryCard = createElement('div', 'card hour-summary-card');
  summaryCard.innerHTML = `
    <h3>本日时辰择要</h3>
    <div class="hour-summary-row">
      <a class="summary-item best" id="goto-best" href="#shichen-${bestIndex}">
        <div class="summary-title">最吉 · ${shiChen.best.ziFlag || shiChen.best.name}</div>
        <div class="summary-detail">${shiChen.best.range} · ${shiChen.best.ganZhi}时 · 黄道${shiChen.best.shen}</div>
        <div class="summary-tags">宜 ${shiChen.best.yi.slice(0, 3).map(t => t.text).join('、') || '—'}</div>
      </a>
      <a class="summary-item worst" id="goto-worst" href="#shichen-${worstIndex}">
        <div class="summary-title">最凶 · ${shiChen.worst.ziFlag || shiChen.worst.name}</div>
        <div class="summary-detail">${shiChen.worst.range} · ${shiChen.worst.ganZhi}时 · 黑道${shiChen.worst.shen}</div>
        <div class="summary-tags">冲${shiChen.worst.chongShengxiao} · 煞${shiChen.worst.sha}方，诸事宜避</div>
      </a>
    </div>
  `;

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

  // 彭祖百忌
  const pengzuCard = createElement('div', 'card pengzu-card');
  const ganIndex = '甲乙丙丁戊己庚辛壬癸'.indexOf(lunar.dayGanZhi[0]);
  const zhiIndex = '子丑寅卯辰巳午未申酉戌亥'.indexOf(lunar.dayGanZhi[1]);
  pengzuCard.innerHTML = `
    <h3>彭祖百忌</h3>
    <div class="pengzu-item">${PENG_ZU_TIAN[ganIndex] || ''}</div>
    <div class="pengzu-item">${PENG_ZU_DI[zhiIndex] || ''}</div>
  `;

  // 时辰吉凶：13 行（早子时 + 丑…亥 + 晚子时）
  const hourCard = createElement('div', 'card hour-card');
  const hourTable = createElement('div', 'hour-table');
  hourTable.innerHTML = shiChen.slots
    .map((h, i) => hourRowHtml(h, i, i === bestIndex, i === worstIndex))
    .join('');

  const legend = `
    <div class="hour-legend">
      <span><i class="dot match"></i>与今日宜忌一致</span>
      <span><i class="dot conflict"></i>与今日宜忌相冲（时宜撞日忌／时忌撞日宜）</span>
      <span><i class="dot neutral"></i>仅此时辰所宜所忌</span>
    </div>
    <div class="hour-zi-note">子时跨日：<b>早子时（00:00–01:00）算今日</b>，日柱取「${shiChen.dayGanZhi}」；<b>晚子时（23:00–24:00）算次日</b>，日柱取「${shiChen.nextDayGanZhi}」，其神煞吉凶与次日早子时同盘。</div>
  `;
  hourCard.innerHTML = `<h3>时辰吉凶 · 黄黑道十二神</h3>${legend}`;
  hourCard.appendChild(hourTable);

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

  app.append(header, nav, summaryCard, lunarCard, yijiCard, pengzuCard, hourCard, farmCard, xiuCard);

  // 点击页头择要平滑滚动到对应时辰
  const scrollTo = (selector: string) => (e: Event) => {
    e.preventDefault();
    document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  summaryCard.querySelector('#goto-best')?.addEventListener('click', scrollTo(`#shichen-${bestIndex}`));
  summaryCard.querySelector('#goto-worst')?.addEventListener('click', scrollTo(`#shichen-${worstIndex}`));
}
