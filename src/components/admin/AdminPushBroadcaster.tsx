/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Radio, Send, Loader2, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

export const AdminPushBroadcaster: React.FC = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [icon, setIcon] = useState('https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png');
  const [badge, setBadge] = useState('https://i.ibb.co/jkzWK6V6/14895-removebg-preview.png');
  const [image, setImage] = useState('');
  const [url, setUrl] = useState('/');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [stats, setStats] = useState<{ sentCount: number; failedCount: number; message: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    setStatus('sending');
    setErrorMsg('');
    setStats(null);

    try {
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          message: body,
          icon,
          badge,
          image,
          url,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setStatus('success');
        setStats({
          sentCount: data.sentCount || 0,
          failedCount: data.failedCount || 0,
          message: data.message || 'Broadcast completed successfully.',
        });
        // Clear dynamic inputs but keep defaults for icon/badge
        setTitle('');
        setBody('');
        setImage('');
        setUrl('/');
      } else {
        setStatus('error');
        setErrorMsg(data.error || 'Server rejected broadcast command.');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message || 'Network protocol error occurred.');
    }
  };

  const resetTerminal = () => {
    setStatus('idle');
    setStats(null);
    setErrorMsg('');
  };

  return (
    <div className="bg-zinc-950 border border-emerald-500/10 rounded-xl p-4 shadow-xl relative overflow-hidden font-mono" id="admin-push-terminal">
      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.01] rounded-full blur-xl pointer-events-none" />
      
      {/* Terminal Title */}
      <div className="flex items-center gap-2.5 pb-3.5 border-b border-zinc-900">
        <div className="p-1.5 rounded bg-emerald-950/20 border border-emerald-500/20 text-emerald-400">
          <Radio className={`w-4 h-4 ${status === 'sending' ? 'animate-pulse text-rose-400' : ''}`} />
        </div>
        <div>
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block leading-none">
            Global Push Broadcaster
          </span>
          <span className="text-[8px] text-zinc-500 uppercase font-sans mt-1 block">
            Broadcast emergency alerts or custom dispatches to PWA/standard web clients.
          </span>
        </div>
      </div>

      {status === 'sending' && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3.5 text-center">
          <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
              Broadcasting Dispatch
            </h4>
            <p className="text-[10px] text-zinc-500 max-w-xs font-sans leading-relaxed">
              Negotiating cryptographic handshakes and delivery headers across active push registration endpoints...
            </p>
          </div>
        </div>
      )}

      {status === 'success' && stats && (
        <div className="py-6 space-y-4">
          <div className="flex flex-col items-center justify-center space-y-2 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Transmission Delivered
            </h4>
          </div>

          <div className="bg-zinc-900/40 border border-emerald-500/10 p-3 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500 uppercase">Successful Deliveries</span>
              <span className="text-emerald-400 font-bold">{stats.sentCount} devices</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500 uppercase">Obsolete Cleared</span>
              <span className="text-rose-400 font-bold">{stats.failedCount} expired</span>
            </div>
            <p className="text-[9px] text-zinc-500 leading-normal font-sans border-t border-zinc-900 pt-2 mt-1">
              {stats.message}
            </p>
          </div>

          <button
            onClick={resetTerminal}
            className="w-full py-2 bg-emerald-950/20 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 text-[9px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Broadcast Terminal</span>
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="py-6 space-y-4">
          <div className="flex items-center gap-2.5 text-rose-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              Broadcasting Terminated
            </h4>
          </div>
          
          <p className="text-[10px] text-zinc-400 leading-relaxed font-sans bg-rose-950/5 border border-rose-500/10 p-3 rounded-lg">
            {errorMsg}
          </p>

          <button
            onClick={resetTerminal}
            className="w-full py-2 bg-rose-950/15 border border-rose-500/20 hover:border-rose-500 text-rose-400 text-[9px] font-bold uppercase tracking-wider rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Broadcast Protocol</span>
          </button>
        </div>
      )}

      {status === 'idle' && (
        <form onSubmit={handleBroadcast} className="pt-4 space-y-3.5">
          {/* Title Field */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">
              Dispatch Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. SECURITY UPDATE: Sector 4 Breach"
              required
              className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-900 rounded focus:outline-none focus:border-emerald-500/40 text-zinc-200"
            />
          </div>

          {/* Body Field */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">
              Message Content / Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="e.g. A new anonymous cryptographic dispatch has been declassified. Connect with standard key identifiers."
              required
              rows={3}
              className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-900 rounded focus:outline-none focus:border-emerald-500/40 text-zinc-200 resize-none font-sans"
            />
          </div>

          {/* Icon Field */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">
              Notification Icon URL
            </label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="e.g. https://example.com/icon.png"
              className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-900 rounded focus:outline-none focus:border-emerald-500/40 text-zinc-200"
            />
          </div>

          {/* Badge Field */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">
              Notification Badge URL
            </label>
            <input
              type="text"
              value={badge}
              onChange={(e) => setBadge(e.target.value)}
              placeholder="e.g. https://example.com/badge.png"
              className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-900 rounded focus:outline-none focus:border-emerald-500/40 text-zinc-200"
            />
          </div>

          {/* Image Field */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">
              Notification Big Image URL (Optional)
            </label>
            <input
              type="text"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="e.g. https://example.com/banner.png"
              className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-900 rounded focus:outline-none focus:border-emerald-500/40 text-zinc-200"
            />
          </div>

          {/* URL Route Field */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">
              Redirection Route / Action URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. /communities"
              className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-900 rounded focus:outline-none focus:border-emerald-500/40 text-zinc-200"
            />
            <p className="text-[8px] text-zinc-600 font-sans">
              Users who click the notification will be automatically redirected to this sub-route.
            </p>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={!title.trim() || !body.trim()}
            className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-950 text-[10px] font-black uppercase tracking-wider rounded transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Transmit Web Push Dispatch</span>
          </button>
        </form>
      )}
    </div>
  );
};
