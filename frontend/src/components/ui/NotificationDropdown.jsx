import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  CheckCheck,
  Clock,
  MessageSquare,
  CreditCard,
  Package,
  Briefcase,
  Sparkles,
  PartyPopper
} from 'lucide-react';
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

// Icon helper using Lucide Icons (Zero emojis)
function getNotificationIcon(notif) {
  const text = `${notif.title || ''} ${notif.message || ''}`.toLowerCase();
  if (text.includes('approv') || text.includes('decision') || text.includes('risk')) {
    return { icon: CheckCircle2, color: 'bg-pop-mint text-slate-900' };
  }
  if (text.includes('negotiat') || text.includes('counter') || text.includes('comment')) {
    return { icon: MessageSquare, color: 'bg-pop-yellow text-slate-900' };
  }
  if (text.includes('invoice') || text.includes('payment') || text.includes('paid')) {
    return { icon: CreditCard, color: 'bg-pop-violet text-white' };
  }
  if (text.includes('fulfill') || text.includes('shipment') || text.includes('warehouse')) {
    return { icon: Package, color: 'bg-pop-pink text-white' };
  }
  return { icon: Briefcase, color: 'bg-pop-sky text-slate-900' };
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
    <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#FFFDF5] border-2 border-slate-900 shadow-pop-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="p-3.5 px-4 border-b-2 border-slate-900 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-pop-violet text-white border border-slate-900 flex items-center justify-center">
            <Bell className="w-3.5 h-3.5" strokeWidth={2.5} />
          </div>
          <h3 className="font-heading font-extrabold text-sm text-slate-900 tracking-tight">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-heading font-black bg-rose-500 text-white border border-slate-900 shadow-pop-sm">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-[11px] font-heading font-bold text-pop-violet hover:underline flex items-center gap-1 cursor-pointer transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" strokeWidth={2.5} />
            Mark all read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-[380px] overflow-y-auto divide-y-2 divide-slate-900/10">
        {displayList.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center text-slate-600">
            <div className="w-12 h-12 rounded-2xl bg-pop-yellow border-2 border-slate-900 shadow-pop-sm flex items-center justify-center mb-2">
              <CheckCircle2 className="w-6 h-6 text-slate-900" strokeWidth={2.5} />
            </div>
            <p className="text-sm font-heading font-bold text-slate-900">All caught up!</p>
            <p className="text-xs text-slate-500 mt-0.5">No notifications right now</p>
          </div>
        ) : (
          displayList.map((notif) => {
            const { icon: Icon, color } = getNotificationIcon(notif);
            return (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={`group p-3.5 px-4 cursor-pointer transition-all hover:bg-pop-yellow/30 relative flex items-start gap-3 ${
                  !notif.is_read
                    ? 'bg-violet-50/80 border-l-4 border-l-pop-violet'
                    : 'border-l-4 border-l-transparent text-slate-600'
                }`}
              >
                {/* Icon */}
                <div className={`w-8 h-8 rounded-xl border-2 border-slate-900 flex items-center justify-center shrink-0 shadow-pop-sm group-hover:scale-105 transition-transform ${color}`}>
                  <Icon className="w-4 h-4" strokeWidth={2.5} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-heading font-bold truncate ${
                        !notif.is_read ? 'text-slate-900' : 'text-slate-600'
                      }`}
                    >
                      {notif.title}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {formatTimeAgo(notif.created_at)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
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
        <div className="p-2.5 bg-white border-t-2 border-slate-900 text-center">
          <p className="text-[11px] font-heading font-bold text-slate-600">
            System Alerts & Deal Flow Feed
          </p>
        </div>
      )}
    </div>
  );
}
