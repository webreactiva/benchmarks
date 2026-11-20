import type { Notice } from '../hooks/useCart';

interface NoticeStackProps {
  notices: readonly Notice[];
  onDismiss: (id: number) => void;
}

export const NoticeStack = ({ notices, onDismiss }: NoticeStackProps) => (
  <div className="notices" role="status" aria-live="polite">
    {notices.map((notice) => (
      <div key={notice.id} className={`notice notice--${notice.kind}`}>
        <span>{notice.message}</span>
        <button type="button" onClick={() => onDismiss(notice.id)} aria-label="Cerrar aviso">
          ×
        </button>
      </div>
    ))}
  </div>
);
