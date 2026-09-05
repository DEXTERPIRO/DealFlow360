import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Clock, ExternalLink, Sparkles } from 'lucide-react';
import { notificationsAPI } from '../../api';

// Helper for relative time
function formatTimeAgo(dateString) {
  if (!dateString) return 'Just now';
  const now = new Date();
  const past = new Date(dateString);
  const elapsedSec = Math.floor((now - past) / 1000);

  if (elapsedSec < 30) return 'Just now';
  if (elapsedSec < 60) return `${elapsedSec}s ago`;
  const elapsedMin = Math.floor(elapsedSec / 60);
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  const elapsedHours = Math.floor(elapsedMin / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays === 1) return 'Yesterday';
  if (elapsedDays < 30) return `${elapsedDays}d ago`;
  return past.toLocaleDateString();
}

// Icon helper based on type/title/message
function getNotificationIcon(notif) {
  const text = `${notif.title || ''} ${notif.message || ''}`.toLowerCase();
  if (text.includes('approv') || text.includes('decision') || text.includes('risk')) {
    return '✅';
  }
  if (text.includes('negotiat') || text.includes('counter') || text.includes('comment')) {
    return '💬';
  }
  if (text.includes('invoice') || text.includes('payment') || text.includes('paid')) {
    return '💳';
  }
  if (text.includes('fulfill') || text.includes('shipment') || text.includes('warehouse')) {
    return '📦';
  }
  return '💼';
}

export default function NotificationDropdown({
  notifications = [],
  setNotifications,
  isOpen,
  onClose
}) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
    } catch (err) {
      // ignore
    }
    if (setNotifications) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
  };

  const handleItemClick = async (notif) => {
    // Mark this one as read
    if (!notif.is_read) {
      try {
        await notificationsAPI.markRead(notif.id);
      } catch (err) {
        // ignore
      }
      if (setNotifications) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      }
    }

    onClose?.();

    // Determine target URL
    if (notif.link) {
      navigate(notif.link);
      return;
    }

    const text = `${notif.title || ''} ${notif.message || ''}`.toLowerCase();
    if (text.includes('approv')) {
      navigate('/approvals');
    } else if (text.includes('fulfill')) {
      navigate('/fulfillment');
    } else if (text.includes('invoice') || text.includes('payment')) {
      navigate('/invoices');
    } else if (text.includes('subscription')) {
      navigate('/subscriptions');
    } else {
      navigate('/quotations');
    }
  };

  const displayList = notifications.slice(0, 20);

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-700/90 shadow-2xl shadow-black/80 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="p-3.5 px-4 border-b border-slate-800 bg-slate-850 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-400" />
          <h3 className="font-bold text-sm text-white tracking-tight">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:underline transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-800/60 scrollbar-thin scrollbar-thumb-slate-700">
        {displayList.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center text-slate-400">
            <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center mb-2 text-xl">
              🎉
            </div>
            <p className="text-sm font-semibold text-slate-300">All caught up!</p>
            <p className="text-xs text-slate-500 mt-0.5">No notifications to display right now</p>
          </div>
        ) : (
          displayList.map((notif) => {
            const icon = getNotificationIcon(notif);
            return (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={`group p-3.5 px-4 cursor-pointer transition-all hover:bg-slate-800/70 relative flex items-start gap-3 ${
                  !notif.is_read
                    ? 'bg-blue-950/20 border-l-4 border-l-blue-500'
                    : 'border-l-4 border-l-transparent text-slate-400'
                }`}
              >
                {/* Icon */}
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center shrink-0 text-base shadow-sm group-hover:scale-105 transition-transform">
                  {icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-semibold truncate ${
                        !notif.is_read ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {notif.title}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {formatTimeAgo(notif.created_at)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {notif.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {displayList.length > 0 && (
        <div className="p-2.5 bg-slate-900 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-400 font-medium">
            All caught up! 🎉
          </p>
        </div>
      )}
    </div>
  );
}
