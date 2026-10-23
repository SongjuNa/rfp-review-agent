export type ViewProps = {
  runId: number
  actorId: number | null
  /** 담당자 확인 단계에서만 후보를 고칠 수 있다 */
  editable: boolean
  /** 결과가 바뀌면 실행 요약(건수)을 다시 부른다 */
  onChanged: () => void
}
