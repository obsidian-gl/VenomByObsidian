/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { 
  Trash2, 
  Lock, 
  Globe, 
  Users, 
  Search, 
  Eye, 
  ShieldAlert, 
  ShieldCheck, 
  ArrowLeft, 
  Key,
  Database,
  Activity,
  Cpu,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminCommunitiesProps {
  onNavigateHome: () => void;
}

export const AdminCommunities: React.FC<AdminCommunitiesProps> = ({ onNavigateHome }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Firestore community documents
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComm, setSelectedComm] = useState<any | null>(null);
  
  // Community active chats state
  const [activeChats, setActiveChats] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  // Check existing session auth
  useEffect(() => {
    const authSession = sessionStorage.getItem('venom_admin_auth');
    if (authSession === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Listen to all communities (including blocked ones)
  useEffect(() => {
    if (!db) return;
    setLoading(true);

    const q = query(collection(db, 'communities'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setCommunities(list);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching communities for admin:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to chats of selected community
  useEffect(() => {
    if (!db || !selectedComm) {
      setActiveChats([]);
      return;
    }

    setLoadingChats(true);
    const chatsRef = collection(db, 'communities', selectedComm.id, 'chats');
    const q = query(chatsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setActiveChats(list);
      setLoadingChats(false);
    }, (error) => {
      console.error('Error fetching chats for admin:', error);
      setLoadingChats(false);
    });

    return () => unsubscribe();
  }, [selectedComm]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    // Matches main admin credentials
    if (username === 'theakshatpopat' && password === 'Aprt9311') {
      setIsAuthenticated(true);
      sessionStorage.setItem('venom_admin_auth', 'true');
      setUsername('');
      setPassword('');
    } else {
      setLoginError('Invalid Administrator credentials. Security breach log generated.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('venom_admin_auth');
  };

  // Permanently delete a community and all of its chats/subcollections
  const handleDeleteCommunity = async (commId: string, commName: string) => {
    const confirmDelete = window.confirm(`[CRITICAL DESTRUCTION PROTOCOL]: Are you absolutely certain you want to permanently delete community "${commName}" and all associated nested chats? This operation is irreversible.`);
    if (!confirmDelete) return;

    try {
      // 1. Fetch and batch delete all chats and nested subcollections
      const chatsRef = collection(db, 'communities', commId, 'chats');
      const chatsSnap = await getDocs(chatsRef);

      const batch = writeBatch(db);

      // Delete chats
      for (const chatDoc of chatsSnap.docs) {
        // Fetch comments of each chat first and delete them
        const commentsRef = collection(db, 'communities', commId, 'chats', chatDoc.id, 'comments');
        const commentsSnap = await getDocs(commentsRef);
        commentsSnap.forEach(commentDoc => {
          batch.delete(doc(db, 'communities', commId, 'chats', chatDoc.id, 'comments', commentDoc.id));
        });

        batch.delete(doc(db, 'communities', commId, 'chats', chatDoc.id));
      }

      // Delete visits tracker subcollection
      const visitsRef = collection(db, 'communities', commId, 'visits');
      const visitsSnap = await getDocs(visitsRef);
      visitsSnap.forEach(visitDoc => {
        batch.delete(doc(db, 'communities', commId, 'visits', visitDoc.id));
      });

      // 2. Delete parent community document
      batch.delete(doc(db, 'communities', commId));

      await batch.commit();

      alert(`Community "${commName}" successfully purged from database core.`);
      if (selectedComm?.id === commId) {
        setSelectedComm(null);
      }
    } catch (err: any) {
      console.error('purging failed:', err);
      alert(`Purging failed: ${err.message || err}`);
    }
  };

  // Permanently delete an individual chat message in a community
  const handleDeleteChat = async (chatId: string) => {
    if (!selectedComm) return;

    const confirmDelete = window.confirm('[ACTION REQUIRED]: Are you sure you want to permanently delete this individual chat dispatch?');
    if (!confirmDelete) return;

    try {
      const batch = writeBatch(db);

      // Fetch comments to delete them in batch
      const commentsRef = collection(db, 'communities', selectedComm.id, 'chats', chatId, 'comments');
      const commentsSnap = await getDocs(commentsRef);
      commentsSnap.forEach(commentDoc => {
        batch.delete(doc(db, 'communities', selectedComm.id, 'chats', chatId, 'comments', commentDoc.id));
      });

      // Delete the chat itself
      batch.delete(doc(db, 'communities', selectedComm.id, 'chats', chatId));

      await batch.commit();
      alert('Message dispatch successfully deleted.');
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert(`Delete failed: ${err.message || err}`);
    }
  };

  const filteredComms = communities.filter(c => {
    if (searchTerm.trim() !== '') {
      const query = searchTerm.toLowerCase();
      return (
        c.name?.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.religion?.toLowerCase().includes(query) ||
        c.createdByIp?.toLowerCase().includes(query) ||
        c.createdByImei?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-mono flex flex-col selection:bg-emerald-500/30 selection:text-emerald-100">
      
      {/* HEADER BAR */}
      <header className="border-b border-zinc-900 bg-black/60 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={onNavigateHome}
          >
            <img 
              src="https://i.ibb.co/RpqhT7QZ/14893-removebg-preview.png" 
              alt="Venom Logo" 
              className="w-11 h-11 object-contain drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]"
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-sm font-black tracking-widest text-emerald-400 leading-tight">
                VENOM SECURITY TERMINAL
              </h1>
              <p className="text-[9px] text-zinc-500 font-mono tracking-wider uppercase leading-none mt-0.5">
                COMMUNITIES SECTOR [admin/communities]
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateHome}
              className="px-3 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 text-zinc-400 hover:text-zinc-200 text-[10px] font-bold rounded transition-colors uppercase tracking-wider cursor-pointer"
            >
              Feed Home
            </button>
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-rose-950/15 hover:bg-rose-950/30 border border-rose-500/20 text-rose-400 text-[10px] font-bold rounded transition-colors uppercase tracking-wider cursor-pointer"
              >
                LOGOUT
              </button>
            )}
          </div>
        </div>
      </header>

      {/* VIEWPORT CONTROLLER */}
      <AnimatePresence mode="wait">
        {!isAuthenticated ? (
          /* LOGIN */
          <motion.div 
            key="login"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="flex-1 flex items-center justify-center p-4 min-h-[70vh]"
          >
            <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-xl p-6 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col items-center justify-center text-center mb-6">
                <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center mb-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                </div>
                <h2 className="text-xs font-black tracking-widest text-zinc-100 uppercase">ACCESS DECRYPTION</h2>
                <p className="text-[9px] text-zinc-500 mt-1 uppercase">Enter credentials for admin/communities</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginError && (
                  <div className="bg-rose-950/20 border border-rose-500/20 text-rose-400 text-[9px] p-2.5 rounded border-l-2 border-l-rose-500 font-mono">
                    {loginError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[8px] uppercase text-zinc-500 block font-bold">ADMIN IDENTITY</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Enter system ID..."
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] uppercase text-zinc-500 block font-bold">CRYPTOGRAPHIC KEY</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter passphrase..."
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-[10px] rounded transition-all uppercase mt-6 tracking-widest flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>INITIALIZE CONSOLE</span>
                </button>
              </form>
            </div>
          </motion.div>
        ) : (
          /* WORKSPACE */
          <motion.main 
            key="workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6"
          >
            
            {/* SEARCH AND CONTROL ROW */}
            <div className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-black tracking-wider uppercase text-zinc-100">COMMUNITIES DISPATCH CORES</h2>
                  <p className="text-[9px] text-zinc-500 uppercase mt-0.5">Purge, inspect, and quarantine decentralized group channels.</p>
                </div>
              </div>

              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  placeholder="Filter by Name, IP, IMEI, Region..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded px-3 py-1.5 pl-8 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700 transition-colors"
                />
                <Search className="w-3.5 h-3.5 text-zinc-600 absolute left-2.5 top-2.5" />
              </div>
            </div>

            {/* DASHBOARD GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* LEFT COLUMN: LIST OF ALL COMMUNITIES (5/12) */}
              <div className="lg:col-span-5 bg-zinc-950 border border-zinc-900 rounded-xl flex flex-col max-h-[70vh] overflow-hidden">
                <div className="p-4 border-b border-zinc-900 bg-zinc-950 shrink-0 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">SECTOR INDEX</span>
                  <span className="text-[10px] font-mono bg-zinc-900 text-zinc-500 px-2 py-0.5 rounded">
                    Total: {communities.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                  {loading ? (
                    <div className="text-center py-8 text-zinc-600 text-[10px]">SYNCING CORES...</div>
                  ) : filteredComms.length === 0 ? (
                    <div className="text-center py-8 text-zinc-600 text-[10px] uppercase">No matching sectors</div>
                  ) : (
                    filteredComms.map((c) => {
                      const isSelected = selectedComm?.id === c.id;
                      const hasFlags = (c.reportsCount || 0) > 0;
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedComm(c)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 relative group ${
                            isSelected
                              ? 'bg-emerald-500/[0.02] border-emerald-500/40'
                              : 'bg-zinc-900/30 border-zinc-900 hover:border-zinc-800'
                          }`}
                        >
                          <img
                            src={c.imageUrl}
                            alt={c.name}
                            className="w-10 h-10 rounded object-cover bg-zinc-900 border border-zinc-800 shrink-0"
                            referrerPolicy="no-referrer"
                          />

                          <div className="min-w-0 flex-1">
                            <h3 className="text-xs font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors truncate">
                              {c.name}
                            </h3>
                            <p className="text-[9px] text-zinc-600 truncate mt-0.5 uppercase">
                              Region: {c.religion} | password: {c.password ? `"${c.password}"` : 'none'}
                            </p>
                            
                            <div className="flex gap-2 items-center mt-2 flex-wrap">
                              {c.isBlocked && (
                                <span className="text-[8px] bg-rose-950/20 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold uppercase shrink-0">
                                  <ShieldAlert className="w-2.5 h-2.5" />
                                  <span>BLOCKED</span>
                                </span>
                              )}
                              {hasFlags && (
                                <span className="text-[8px] bg-amber-950/20 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold shrink-0">
                                  FLAGS: {c.reportsCount || 0}/100
                                </span>
                              )}
                              <span className="text-[8px] bg-zinc-900 text-zinc-500 px-1.5 py-0.5 rounded font-bold shrink-0">
                                REVIEWS: {c.viewsCount || 0}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCommunity(c.id, c.name);
                            }}
                            className="p-1.5 text-zinc-600 hover:text-rose-400 transition-colors shrink-0 rounded hover:bg-rose-950/10 cursor-pointer"
                            title="PERMANENTLY DELETE COMMUNITY"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: DETAILED DISPATCH INSPECT PANEL (7/12) */}
              <div className="lg:col-span-7 bg-zinc-950 border border-zinc-900 rounded-xl flex flex-col min-h-[50vh] max-h-[70vh] overflow-hidden">
                {selectedComm ? (
                  <>
                    {/* Selected Community Metadata Inspector Header */}
                    <div className="p-4 border-b border-zinc-900 bg-zinc-950 shrink-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">SECTOR TELEMETRY INSPECTOR</span>
                        <span className="text-[9px] font-mono text-zinc-500 uppercase">ID: {selectedComm.id}</span>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 p-3 bg-[#050505] border border-zinc-900 rounded-lg">
                        <div>
                          <span className="text-[8px] text-zinc-600 block uppercase">CREATOR IP</span>
                          <span className="text-[10px] font-bold text-zinc-400">{selectedComm.createdByIp || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-600 block uppercase">CREATOR IMEI / SN</span>
                          <span className="text-[10px] font-bold text-zinc-400 truncate block max-w-xs">
                            {selectedComm.createdByImei || 'N/A'} 
                            {selectedComm.createdByImei && ` | ` + (() => {
                              const creatorImei = selectedComm.createdByImei;
                              let hash = 0;
                              for (let i = 0; i < creatorImei.length; i++) {
                                hash = creatorImei.charCodeAt(i) + ((hash << 5) - hash);
                              }
                              const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                              let creatorSerial = 'VSN';
                              for (let i = 0; i < 10; i++) {
                                creatorSerial += chars.charAt(Math.abs((hash + i * 23) % chars.length));
                              }
                              return creatorSerial;
                            })()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-600 block uppercase">GATE LOCK</span>
                          <span className="text-[10px] font-bold text-zinc-400">{selectedComm.password ? `"${selectedComm.password}"` : 'NONE'}</span>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-600 block uppercase">PERMISSIONS</span>
                          <span className="text-[10px] font-bold text-zinc-400">{selectedComm.allowUserPost ? 'MEMBERS CAN POST' : 'OWNER ONLY'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Chats scroll lists */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#020202]">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block">DISPATCH CHATS IN COHORT</span>
                      
                      {loadingChats ? (
                        <div className="text-center py-12 text-zinc-600 text-[10px]">SYNCING MESSAGE CHATS...</div>
                      ) : activeChats.length === 0 ? (
                        <div className="text-center py-12 text-zinc-600 text-[10px] uppercase">COHORT DISPATCH SHELL IS EMPTY</div>
                      ) : (
                        activeChats.map((chat) => {
                          const dispatcherImei = chat.createdByImei || '359182371283718';
                          let dispHash = 0;
                          for (let i = 0; i < dispatcherImei.length; i++) {
                            dispHash = dispatcherImei.charCodeAt(i) + ((dispHash << 5) - dispHash);
                          }
                          const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                          let dispatcherSerial = 'VSN';
                          for (let i = 0; i < 10; i++) {
                            dispatcherSerial += chars.charAt(Math.abs((dispHash + i * 23) % chars.length));
                          }

                          return (
                            <div
                              key={chat.id}
                              className="p-3 bg-zinc-950 border border-zinc-900 hover:border-zinc-850 rounded-lg transition-all flex items-start gap-4 relative"
                            >
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex justify-between items-center text-[8px] font-mono text-zinc-600">
                                  <span>DISPATCHER IP: {chat.createdByIp || 'N/A'}</span>
                                  <span>IMEI: {chat.createdByImei || 'N/A'} | S/N: {dispatcherSerial}</span>
                                </div>

                              <p className="text-[11px] text-zinc-300 whitespace-pre-wrap font-sans">
                                {chat.content}
                              </p>

                              {chat.imageUrl && (
                                <img
                                  src={chat.imageUrl}
                                  alt="Payload graphic"
                                  className="w-24 h-24 rounded object-cover border border-zinc-900 bg-zinc-900 mt-2"
                                  referrerPolicy="no-referrer"
                                />
                              )}

                              <div className="flex gap-3 text-[9px] text-zinc-600 font-mono">
                                <span>Type: {chat.type?.toUpperCase()}</span>
                                <span>Likes: {chat.likesCount || 0}</span>
                                <span>Comments: {chat.commentsCount || 0}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteChat(chat.id)}
                              className="p-1.5 text-zinc-700 hover:text-rose-400 rounded hover:bg-rose-950/15 cursor-pointer shrink-0 transition-colors"
                              title="PURGE DISPATCH MESSAGE"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )})
                      )}
                    </div>
                  </>
                ) : (
                  <div className="m-auto text-center space-y-2 p-6">
                    <Eye className="w-8 h-8 text-zinc-800 mx-auto" />
                    <span className="text-[10px] text-zinc-600 uppercase block">SELECT A COHORT CORE TO INSPECT</span>
                  </div>
                )}
              </div>

            </div>

          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminCommunities;
