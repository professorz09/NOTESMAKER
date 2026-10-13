import React from 'react';
import { AlertTriangle } from 'lucide-react';
import '../liquid-panels.css';

interface ClearConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ClearConfirmModal: React.FC<ClearConfirmModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="nm-sheet-wrap nm-backdrop z-[70]"
      onClick={onCancel}
    >
      <div
        className="nm-sheet nm-sheet-b sm:max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="nm-sheet-grab" />
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="nm-ico-badge danger">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="nm-head font-bold text-base">Clear editor?</h3>
              <p className="nm-muted text-sm">This will erase all current content.</p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={onCancel}
              className="nm-btn flex-1 min-h-[44px] text-sm"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="nm-btn-danger-solid flex-1 min-h-[44px] text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
