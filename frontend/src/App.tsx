import { type ReactNode } from 'react'
import { type MenuKey } from './shell/menu'
import { useHashPath } from './shell/router'
import { Shell, type Crumb } from './shell/Shell'
import { Register } from './views/Register'
import { ReviewDetail } from './views/ReviewDetail'
import { ReviewList } from './views/ReviewList'
import { Home } from './views/Home'
import { Datasheet } from './views/Datasheet'
import { findProject } from './examples/SCR-04'
import { findBid } from './examples/SCR-14'
import { BidView } from './views/examples/BidView'
import { Bids } from './views/examples/Bids'
import { Eval } from './views/examples/Eval'
import { Files } from './views/examples/Files'
import { Login } from './views/examples/Login'
import { Notice } from './views/examples/Notice'
import { Phrases } from './views/examples/Phrases'
import { Project } from './views/examples/Project'
import { Settings } from './views/examples/Settings'
import { SysNotice } from './views/examples/SysNotice'
import { Team } from './views/examples/Team'
import { Projects } from './views/examples/Projects'
import { Products } from './views/Products'
import { Rules } from './views/Rules'
import { Tbe } from './views/Tbe'
import { Todo } from './views/Todo'

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
  const bid = path.match(/^\/bids\/([^/]+)$/)
  if (bid) {
    const b = findBid(decodeURIComponent(bid[1]))
    return { menu: 'bids', crumbs: [home, { label: '입찰 이력', path: '/bids' }, { label: b.bid }], body: <BidView key={b.bid} bid={b} /> }
  }
  if (path === '/bids') {
    return { menu: 'bids', crumbs: [home, { label: '입찰 이력' }], body: <Bids /> }
  }
  const project = path.match(/^\/projects\/([^/]+)$/)
  if (project) {
    const p = findProject(decodeURIComponent(project[1]))
    return { menu: 'projects', crumbs: [home, { label: 'RFP 관리' }, { label: '사업 현황', path: '/projects' }, { label: '사업 상세' }], body: <Project key={p.id} project={p} /> }
  }
  if (path === '/projects') {
    return { menu: 'projects', crumbs: [home, { label: 'RFP 관리' }, { label: '사업 현황' }], body: <Projects /> }
  }
  if (path === '/phrases') {
    return { menu: 'phrases', crumbs: [home, { label: '지식 관리' }, { label: '표준 문구' }], body: <Phrases /> }
  }
  if (path === '/eval') {
    return { menu: 'eval', crumbs: [home, { label: '지식 관리' }, { label: '정답지·채점' }], body: <Eval /> }
  }
  if (path === '/team') {
    return { menu: 'team', crumbs: [home, { label: '팀 공유' }, { label: '팀 현황' }], body: <Team /> }
  }
  if (path === '/notice') {
    return { menu: 'notice', crumbs: [home, { label: '팀 공유' }, { label: '공지사항' }], body: <Notice /> }
  }
  if (path === '/sysnotice') {
    return { menu: 'sysnotice', crumbs: [home, { label: '팀 공유' }, { label: '시스템 공지' }], body: <SysNotice /> }
  }
  if (path === '/files') {
    return { menu: 'files', crumbs: [home, { label: '팀 공유' }, { label: '자료실' }], body: <Files /> }
  }
  if (path === '/settings') {
    return { menu: 'settings', crumbs: [home, { label: '설정' }], body: <Settings /> }
  }
  if (path === '/todo') {
    return { menu: 'todo', crumbs: [home, { label: '협조 요청 현황' }], body: <Todo /> }
  }
  // 모르는 주소는 홈을 보인다 (모든 메뉴 화면을 만들었다)
  return { menu: 'home', crumbs: [{ label: '홈' }], body: <Home /> }
}

export default function App() {
  const path = useHashPath()
  // 로그인 화면은 앱 틀(메뉴·머리글) 없이 화면 전체를 쓴다 (SCR-01-로그인.md)
  if (path === '/login') return <Login />
  const { menu, crumbs, body } = route(path)
  return <Shell active={menu} crumbs={crumbs}>{body}</Shell>
}
