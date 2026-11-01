// SCR-08 검토 상세 탭 이름 (목업 v4.96 .pgtabs2, update-detail-header)

/** 탭 줄에 늘 보이는 탭 */
export const MAIN_TABS = [['judge', '판정'], ['risk', '위험 조건'], ['read', '문서 읽기 점검'], ['comm', '상업 조건'], ['log', '이력']] as const
/** "더 보기" 안의 탭 */
export const MORE_TABS = [['loss', '손실 환산 (참고)'], ['bid', '입찰 영향'], ['cmp', '지난 RFP 비교'], ['subm', '제출본']] as const
export type DetailTab = (typeof MAIN_TABS)[number][0] | (typeof MORE_TABS)[number][0]

