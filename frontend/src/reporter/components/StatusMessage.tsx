import type { StatusType } from '../types.ts';

interface Props {
  text: string;
  type: StatusType;
}

export function StatusMessage({ text, type }: Props) {
  if (!text) return null;
  return <div className={`status-msg ${type}`}>{text}</div>;
}
