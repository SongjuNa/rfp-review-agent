import { type ReactNode } from 'react'
import { ALL_ITEMS, itemOf, type MenuKey } from './shell/menu'
import { useHashPath } from './shell/router'
import { Shell, type Crumb } from './shell/Shell'
import { Register } from './views/Register'
import { ReviewDetail } from './views/ReviewDetail'
import { ReviewList } from './views/ReviewList'
import { Home } from './views/Home'
import { Datasheet } from './views/Datasheet'
import { Products } from './views/Products'
import { Rules } from './views/Rules'
import { Tbe } from './views/Tbe'
import { Todo } from './views/Todo'

/** 아직 만들지 않은 화면 자리. 목업 순서대로 하나씩 채운다 (docs/screens/README.md 1장). */
function NotYet({ menu }: { menu: MenuKey }) {
  const item = itemOf(menu)
  return (
    <main className="main">
      <div className="ttl"><h1>{item.label}</h1></div>
      <div className="ronote todo-scr" role="note">
        <span className="ms" aria-hidden="true">construction</span>
        <span><b>{item.scr} {item.label}</b> 화면은 아직 만들지 않았습니다. 목업 v4.57 순서대로 만들 예정입니다.</span>
      </div>
    </main>
  )
}

type Route = { menu: MenuKey; crumbs: Crumb[]; body: ReactNode }

/** 화면 주소 → 화면 (docs/screens/SCR-00-앱틀.md 2장). */
function route(path: string): Route {
  const home: Crumb = { label: '홈', path: '/' }
  const sheet = path.match(/^\/reviews\/(\d+)\/datasheet$/)
  if (sheet) {
    const id = Number(sheet[1])
    return { menu: 'reviews', crumbs: [home, { label: 'RFP 검토', path: '/reviews' }, { label: '검토 상세', path: `/reviews/${id}`, tail: true },
      { label: '데이터시트 채우기' }], body: <Datasheet runId={id} /> }
  }
  const tbe = path.match(/^\/reviews\/(\d+)\/tbe$/)
  if (tbe) {
    const id = Number(tbe[1])
    return { menu: 'reviews', crumbs: [home, { label: 'RFP 검토', path: '/reviews' }, { label: '검토 상세', path: `/reviews/${id}`, tail: true },
      { label: 'TBE 준수표' }], body: <Tbe runId={id} /> }
  }
  const review = path.match(/^\/reviews\/(\d+)/)
  if (review) {
    const id = Number(review[1])
    return { menu: 'reviews', crumbs: [home, { label: 'RFP 검토', path: '/reviews' }, { label: '검토 상세' }], body: <ReviewDetail runId={id} /> }
  }
  if (path === '/reviews') {
    return { menu: 'reviews', crumbs: [home, { label: 'RFP 검토', path: '/reviews' }, { label: '검토 목록' }], body: <ReviewList /> }
  }
  if (path === '/register') {
    return { menu: 'register', crumbs: [home, { label: 'RFP 검토', path: '/reviews' }, { label: '검토 등록' }], body: <Register /> }
  }
  if (path === '/' || path === '') {
    return { menu: 'home', crumbs: [{ label: '홈' }], body: <Home /> }
  }
  if (path === '/products') {
    return { menu: 'products', crumbs: [home, { label: '기준 데이터' }, { label: '제품표' }], body: <Products /> }
  }
  if (path === '/rules') {
    return { menu: 'rules', crumbs: [home, { label: '기준 데이터' }, { label: '판정 규칙' }], body: <Rules /> }
  }
  if (path === '/todo') {
    return { menu: 'todo', crumbs: [home, { label: '협조 요청 현황' }], body: <Todo /> }
  }
  const item = ALL_ITEMS.find((i) => i.path === path) ?? itemOf('home')
  const crumbs = item.key === 'home' ? [{ label: '홈' }] : [home, { label: item.label }]
  return { menu: item.key, crumbs, body: <NotYet menu={item.key} /> }
}

export default function App() {
  const path = useHashPath()
  const { menu, crumbs, body } = route(path)
  return <Shell active={menu} crumbs={crumbs}>{body}</Shell>
}
