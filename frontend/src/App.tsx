import { type ReactNode } from 'react'
import { type MenuKey } from './shell/menu'
import { useHashPath } from './shell/router'
import { Shell, type Crumb } from './shell/Shell'
import { Register } from './views/Register'
import { ReviewDetail } from './views/ReviewDetail'
import { ReviewList } from './views/ReviewList'
import { Home } from './views/Home'
import { Datasheet } from './views/Datasheet'
import { businessIdOf } from './api'
import { findBid } from './examples/SCR-14'
import { BidView } from './views/examples/BidView'
import { Bids } from './views/examples/Bids'
import { Eval } from './views/Eval'
import { Files } from './views/examples/Files'
import { Login } from './views/examples/Login'
import { Notice } from './views/examples/Notice'
import { Phrases } from './views/examples/Phrases'
import { Project } from './views/Project'
import { Settings } from './views/examples/Settings'
import { SysNotice } from './views/examples/SysNotice'
import { Team } from './views/examples/Team'
import { Projects } from './views/Projects'
import { Products } from './views/Products'
import { RunLog } from './views/RunLog'
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
  if (path === '/reviews' || path.startsWith('/reviews?')) {
    return { menu: 'reviews', crumbs: [home, { label: 'RFP 검토', path: '/reviews' }, { label: '검토 목록' }], body: <ReviewList /> }
  }
  // 사업 상세의 "이 사업에 RFP 등록"은 그 사업을 고른 채 연다 (add-project-status)
  const register = path.match(/^\/register(?:\/business\/(\d+))?$/)
  if (register) {
    const businessId = register[1] ? Number(register[1]) : null
    return { menu: 'register', crumbs: [home, { label: 'RFP 검토', path: '/reviews' }, { label: '검토 등록' }],
      body: <Register key={businessId ?? 'new'} businessId={businessId} /> }
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
    const no = decodeURIComponent(project[1])
    const id = businessIdOf(no)
    return { menu: 'projects', crumbs: [home, { label: 'RFP 관리' }, { label: '사업 현황', path: '/projects' }, { label: id === null ? '사업 상세' : no }],
      body: id === null ? <Projects /> : <Project key={id} businessId={id} /> }
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
  if (path === '/runlog') {
    return { menu: 'runlog', crumbs: [home, { label: '지식 관리' }, { label: '실행 기록' }], body: <RunLog /> }
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
