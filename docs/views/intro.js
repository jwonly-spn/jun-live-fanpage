// 첫 화면(서비스 소개)
import { h, applyTheme } from '../lib/dom.js';
import { ilink } from './common.js';
import { isDemo } from '../api.js';

export function renderIntro(root, app, { notFound = false } = {}) {
  document.title = notFound ? '페이지를 찾을 수 없어요 · JUN LIVE 팬페이지' : 'JUN LIVE 팬페이지';
  const shell = h('div', { class: 'fp intro' });
  applyTheme(shell, 'lavender');
  applyTheme(document.documentElement, 'lavender');
  const features = [
    ['내 방송에 맞는 메뉴', '글 게시판, 사진 앨범, 박제판, 팬 라운지, 출석 체크, 투표, 랭킹, 기념일, 링크 모음 중에서 골라 최대 12개까지 만들어요.'],
    ['사진은 자르지 않아요', '세로로 긴 사진도, 가로 사진도 원래 모양 그대로 보여 줘요.'],
    ['JUN LIVE와 함께 움직여요', '방송을 켜면 ‘지금 방송 중’이 보이고, 후원·애청 랭킹이 자동으로 바뀌어요. 금액은 보이지 않아요.'],
    ['팬들과 가까이', '팬들은 로그인 없이 닉네임으로 한마디를 남기고, 출석 도장을 찍고, 투표해요.'],
  ];
  shell.append(h('main', { id: 'main', class: 'fp-main intro-main' },
    notFound ? h('div', { class: 'card pad stack', role: 'alert' }, h('h1', { class: 'sec-title' }, '페이지를 찾을 수 없어요'), h('p', { class: 'muted' }, '주소가 맞는지 확인해 주세요.')) : null,
    h('section', { class: 'intro-hero' },
      h('span', { class: 'eyebrow' }, 'JUN LIVE 팬페이지'),
      h('h1', { class: 'display' }, '스푼 DJ를 위한\n다정한 팬페이지'),
      h('p', { class: 'intro' }, '방송 밖에서도 팬들과 추억을 쌓는 나만의 공간이에요.'),
      h('p', { class: 'soft-box' }, 'JUN LIVE 프로그램의 ‘팬페이지 꾸미기’에서 만들 수 있어요.'),
      h('div', { class: 'row gap wrap' }, ilink(app.link({ name: 'mobile' }), { class: 'btn btn-accent' }, 'PC가 없어요 · 휴대폰으로 시작'))),
    h('ul', { class: 'intro-features' }, features.map(([t, d]) => h('li', { class: 'card pad' }, h('b', null, t), h('p', { class: 'muted' }, d)))),
    isDemo() ? h('section', { class: 'card pad stack' },
      h('h2', { class: 'sec-title sm' }, '체험 모드'),
      h('p', { class: 'muted small' }, '서버 없이 예시 내용으로 모든 화면을 둘러볼 수 있어요. 바꾼 내용은 이 브라우저에만 남아요.'),
      h('div', { class: 'row gap wrap' },
        ilink(app.link({ name: 'fan', slug: 'haru' }), { class: 'btn btn-accent' }, '예시 팬페이지 보기'),
        ilink(app.link({ name: 'studio' }), { class: 'btn btn-line' }, '꾸미기 화면 보기'))) : null,
    h('footer', { class: 'fp-foot' }, 'JUN LIVE 팬페이지')));
  root.replaceChildren(shell);
}
