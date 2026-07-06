/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  setDoc, 
  getDoc,
  updateDoc, 
  increment, 
  serverTimestamp,
  deleteDoc,
  getDocs,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  Users, 
  Search, 
  Plus, 
  Pin, 
  Lock, 
  Unlock, 
  Globe, 
  ArrowLeft, 
  Send, 
  Image as ImageIcon, 
  BarChart2, 
  HelpCircle, 
  Heart, 
  MessageSquare, 
  Share2, 
  Settings, 
  X, 
  ChevronRight, 
  Flag,
  UserCheck,
  Check,
  Trash2,
  AlertTriangle,
  Eye,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getClientIp, getDeviceIdentifier, isMobileDevice } from '../utils/ip';
import { generatePostHash } from '../utils/crypto';
import { compressImageToBase64 } from '../utils/image';
import { checkIpBlockStatus } from '../utils/blockChecker';

// Reaction Emojis
const REACTIONS = [
  { key: 'love', emoji: '❤️' },
  { key: 'fire', emoji: '🔥' },
  { key: 'laugh', emoji: '😂' },
  { key: 'wow', emoji: '😮' },
  { key: 'like', emoji: '👍' },
  { key: 'angry', emoji: '😡' }
];

interface CommunitiesPageProps {
  onBackToHome: () => void;
  posts: any[]; // Main feed posts to check if user has posted at least 1 post
}

export default function CommunitiesPage({ onBackToHome, posts }: CommunitiesPageProps) {
  // Device details
  const [deviceIp, setDeviceIp] = useState('');
  const [deviceSig, setDeviceSig] = useState({ type: 'SERIAL', value: '' });

  // Pinned communities local storage state (maximum 5)
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  // Communities list states
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'latest' | 'most_joined' | 'least_joined'>('latest');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRegion, setFilterRegion] = useState('all');

  // Active chat view state
  const [activeCommunity, setActiveCommunity] = useState<any | null>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  // Community creation states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hasPostedAtLeastOnce, setHasPostedAtLeastOnce] = useState(false);
  
  // Creation Form State
  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cReligion, setCReligion] = useState('');
  const [cUserLimit, setCUserLimit] = useState('');
  const [cAllowUserPost, setCAllowUserPost] = useState(true);
  const [cPassword, setCPassword] = useState('');
  const [cImageUrl, setCImageUrl] = useState('');
  const [cImagePreview, setCImagePreview] = useState('');
  const [cError, setCError] = useState('');
  const [cSubmitting, setCSubmitting] = useState(false);

  // Settings Edit Form State (for Community creator)
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editReligion, setEditReligion] = useState('');
  const [editUserLimit, setEditUserLimit] = useState('');
  const [editAllowUserPost, setEditAllowUserPost] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editImagePreview, setEditImagePreview] = useState('');
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Password Gate Modal
  const [showPasswordGate, setShowPasswordGate] = useState<any | null>(null);
  const [gatePasswordInput, setGatePasswordInput] = useState('');
  const [gateError, setGateError] = useState('');

  // Active Chat Message Creation States
  const [chatType, setChatType] = useState<'text' | 'image' | 'poll' | 'qa'>('text');
  const [chatContent, setChatContent] = useState('');
  const [chatImageUrl, setChatImageUrl] = useState('');
  const [chatImagePreview, setChatImagePreview] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [qaCorrectIndex, setQaCorrectIndex] = useState<number | null>(null);
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState('');

  // Active Chat Comments Panel
  const [commentingOnChat, setCommentingOnChat] = useState<any | null>(null);
  const [chatComments, setChatComments] = useState<any[]>([]);
  const [newCommentContent, setNewCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Reaction dropdown active pointer
  const [reactionMenuChatId, setReactionMenuChatId] = useState<string | null>(null);

  // Local storage interactions tracker for client security and instant renders
  const [likedChats, setLikedChats] = useState<string[]>([]);
  const [votedChatsPolls, setVotedChatsPolls] = useState<{ [chatId: string]: number }>({});
  const [userChatReactions, setUserChatReactions] = useState<{ [chatId: string]: string }>({});

  // Deep linking sharing state
  const [initialDeepLinkProcessed, setInitialDeepLinkProcessed] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);

  // Load user identities & local persistent interaction lists
  useEffect(() => {
    const initDevice = async () => {
      const ip = await getClientIp();
      const sig = getDeviceIdentifier();
      setDeviceIp(ip);
      setDeviceSig(sig);

      // Check if user has posted at least 1 post on the main feed
      const hasPosted = posts.some(
        p => p.postedFromIp === ip || p.postedFromImei === sig.value
      );
      setHasPostedAtLeastOnce(hasPosted);
    };

    initDevice();

    // Load pinned list from local storage
    const savedPins = localStorage.getItem('venom_pinned_communities');
    if (savedPins) {
      try {
        setPinnedIds(JSON.parse(savedPins));
      } catch (e) {
        console.warn('Pinned list loading error:', e);
      }
    }

    // Load liked chats list from local storage
    const savedLiked = localStorage.getItem('venom_liked_chats');
    if (savedLiked) {
      try { setLikedChats(JSON.parse(savedLiked)); } catch(e){}
    }

    // Load voted chats polls from local storage
    const savedVotedPolls = localStorage.getItem('venom_voted_chats_polls');
    if (savedVotedPolls) {
      try { setVotedChatsPolls(JSON.parse(savedVotedPolls)); } catch(e){}
    }

    // Load chat reactions from local storage
    const savedReactions = localStorage.getItem('venom_chat_reactions');
    if (savedReactions) {
      try { setUserChatReactions(JSON.parse(savedReactions)); } catch(e){}
    }
  }, [posts]);

  // Listen to all Communities from Firestore in real-time
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
      console.error('Error fetching communities:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to Chats in the active Community in real-time
  useEffect(() => {
    if (!db || !activeCommunity) {
      setChats([]);
      return;
    }

    setLoadingChats(true);
    const chatsRef = collection(db, 'communities', activeCommunity.id, 'chats');
    const q = query(chatsRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setChats(list);
      setLoadingChats(false);

      // Auto-scroll to bottom of chat
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }, (error) => {
      console.error('Error fetching chats:', error);
      setLoadingChats(false);
    });

    return () => unsubscribe();
  }, [activeCommunity]);

  // Listen to Comments for the active selected chat
  useEffect(() => {
    if (!db || !activeCommunity || !commentingOnChat) {
      setChatComments([]);
      return;
    }

    const commentsRef = collection(db, 'communities', activeCommunity.id, 'chats', commentingOnChat.id, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setChatComments(list);
    }, (error) => {
      console.error('Error fetching chat comments:', error);
    });

    return () => unsubscribe();
  }, [activeCommunity, commentingOnChat]);

  // Deep-linking shared chat auto-routing & scroll highlight
  useEffect(() => {
    if (communities.length === 0 || initialDeepLinkProcessed) return;

    const params = new URLSearchParams(window.location.search);
    const sharedCommunityId = params.get('communityId');
    const sharedChatId = params.get('chatId');

    if (sharedCommunityId) {
      const targetComm = communities.find(c => c.id === sharedCommunityId);
      if (targetComm && !targetComm.isBlocked) {
        setInitialDeepLinkProcessed(true);

        // If password is set on shared community, open password gate
        if (targetComm.password) {
          setShowPasswordGate(targetComm);
        } else {
          // Join the community automatically
          handleEnterCommunityDirect(targetComm, sharedChatId);
        }
      }
    }
  }, [communities, initialDeepLinkProcessed]);

  // Device unique visits counter check & community entry trigger
  const handleEnterCommunityDirect = async (comm: any, sharedChatId?: string | null) => {
    try {
      setActiveCommunity(comm);

      // Record visit dynamically (using device IP)
      if (deviceIp) {
        const visitDocRef = doc(db, 'communities', comm.id, 'visits', deviceIp);
        const visitSnap = await getDoc(visitDocRef);

        if (!visitSnap.exists()) {
          // Transactional write: Record visit & increment viewsCount on parent Community
          const batch = writeBatch(db);
          batch.set(visitDocRef, {
            ip: deviceIp,
            visitedAt: serverTimestamp()
          });
          batch.update(doc(db, 'communities', comm.id), {
            viewsCount: increment(1)
          });
          await batch.commit();
        }
      }

      // If deep linking a specific chat, trigger an automatic focus/scroll highlight
      if (sharedChatId) {
        setTimeout(() => {
          const targetMessage = document.getElementById(`chat-${sharedChatId}`);
          if (targetMessage) {
            targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetMessage.classList.add('animate-pulse', 'border-emerald-400', 'shadow-[0_0_15px_rgba(16,185,129,0.3)]');
            setTimeout(() => {
              targetMessage.classList.remove('animate-pulse', 'border-emerald-400', 'shadow-[0_0_15px_rgba(16,185,129,0.3)]');
            }, 3000);
          }
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to register community visit:', err);
    }
  };

  // Toggle Pinned status (limit 5)
  const handleTogglePin = (e: React.MouseEvent, commId: string) => {
    e.stopPropagation();
    let updatedPins = [...pinnedIds];
    if (pinnedIds.includes(commId)) {
      updatedPins = updatedPins.filter(id => id !== commId);
    } else {
      if (updatedPins.length >= 5) {
        alert('CRITICAL OVERLOAD: You can pin up to 5 priority communities only.');
        return;
      }
      updatedPins.push(commId);
    }
    setPinnedIds(updatedPins);
    localStorage.setItem('venom_pinned_communities', JSON.stringify(updatedPins));
  };

  // Submit Community Creation
  const handleCreateCommunitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPostedAtLeastOnce) {
      setCError('CLEARANCE SUSPENDED: You must make at least 1 main grid Venom post from this device first.');
      return;
    }
    if (!cName.trim() || !cDesc.trim() || !cReligion.trim()) {
      setCError('All highlighted fields are required to seed.');
      return;
    }

    setCSubmitting(true);
    setCError('');

    try {
      const commsRef = collection(db, 'communities');
      const customCommRef = doc(commsRef);
      const commId = customCommRef.id;

      // Check if creator is blacklisted before creating community
      const block = await checkIpBlockStatus(deviceIp, deviceSig.value);
      if (block.isBlocked) {
        setCError('TRANSMISSION QUARANTINED: Device blacklisted.');
        setCSubmitting(false);
        return;
      }

      const payload = {
        id: commId,
        name: cName.trim(),
        description: cDesc.trim(),
        religion: cReligion.trim(),
        userLimit: cUserLimit ? parseInt(cUserLimit) : null,
        allowUserPost: cAllowUserPost,
        password: cPassword.trim() || '',
        createdByIp: deviceIp,
        createdByImei: deviceSig.value,
        createdAt: serverTimestamp(),
        reportsCount: 0,
        isBlocked: false,
        viewsCount: 0,
        imageUrl: cImageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&h=150&q=80'
      };

      await setDoc(customCommRef, payload);
      
      // Auto pin the created community
      const updatedPins = [...pinnedIds, commId].slice(0, 5);
      setPinnedIds(updatedPins);
      localStorage.setItem('venom_pinned_communities', JSON.stringify(updatedPins));

      // Reset form
      setCName('');
      setCDesc('');
      setCReligion('');
      setCUserLimit('');
      setCAllowUserPost(true);
      setCPassword('');
      setCImageUrl('');
      setCImagePreview('');
      setShowCreateModal(false);

      // Automatically join the newly created community
      handleEnterCommunityDirect(payload);
    } catch (err: any) {
      setCError('Failed to create community. Try again.');
      handleFirestoreError(err, OperationType.WRITE, 'communities');
    } finally {
      setCSubmitting(false);
    }
  };

  // Submit Community Settings Update (Creator-only)
  const handleUpdateSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunity || activeCommunity.createdByImei !== deviceSig.value) {
      setEditError('SECURITY ALERT: Authorization mismatch.');
      return;
    }
    if (!editName.trim() || !editDesc.trim() || !editReligion.trim()) {
      setEditError('Highlighted fields are mandatory.');
      return;
    }

    setEditSubmitting(true);
    setEditError('');

    try {
      const commDocRef = doc(db, 'communities', activeCommunity.id);
      const updatedFields = {
        name: editName.trim(),
        description: editDesc.trim(),
        religion: editReligion.trim(),
        userLimit: editUserLimit ? parseInt(editUserLimit) : null,
        allowUserPost: editAllowUserPost,
        password: editPassword.trim() || '',
        imageUrl: editImageUrl || activeCommunity.imageUrl
      };

      await updateDoc(commDocRef, updatedFields);

      // Sync active state
      setActiveCommunity((prev: any) => ({
        ...prev,
        ...updatedFields
      }));

      setShowSettingsModal(false);
    } catch (err: any) {
      setEditError('Update rejected.');
      handleFirestoreError(err, OperationType.UPDATE, `communities/${activeCommunity.id}`);
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle image attachment compression (for creating communities & messages)
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: 'create' | 'edit' | 'chat') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const compressedBase64 = await compressImageToBase64(file, 400, 0.85);
        if (target === 'create') {
          setCImagePreview(URL.createObjectURL(file));
          setCImageUrl(compressedBase64);
        } else if (target === 'edit') {
          setEditImagePreview(URL.createObjectURL(file));
          setEditImageUrl(compressedBase64);
        } else if (target === 'chat') {
          setChatImagePreview(URL.createObjectURL(file));
          setChatImageUrl(compressedBase64);
        }
      } catch (err) {
        console.error('Failed compression:', err);
      }
    }
  };

  // Password gate trigger
  const handlePasswordGateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGateError('');
    if (gatePasswordInput === showPasswordGate.password) {
      const targetComm = showPasswordGate;
      setShowPasswordGate(null);
      setGatePasswordInput('');
      handleEnterCommunityDirect(targetComm);
    } else {
      setGateError('DECRYPTION FAILURE: Incendiary password. Access denied.');
    }
  };

  // Send Chat Message inside community (WhatsApp style)
  const handleSendChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunity) return;

    // Check if posting is restricted to owner only
    const isOwner = activeCommunity.createdByImei === deviceSig.value;
    if (!activeCommunity.allowUserPost && !isOwner) {
      setChatError('RESTRICTED GATEWAY: Only the owner is authorized to dispatch chats inside this community.');
      return;
    }

    if (chatType !== 'image' && !chatContent.trim()) {
      setChatError('Message body is required.');
      return;
    }

    setSendingChat(true);
    setChatError('');

    try {
      // Validate block status
      const block = await checkIpBlockStatus(deviceIp, deviceSig.value);
      if (block.isBlocked) {
        setChatError('TRANSMISSION SHIELD: Device suspended.');
        setSendingChat(false);
        return;
      }

      const chatsRef = collection(db, 'communities', activeCommunity.id, 'chats');
      const customChatRef = doc(chatsRef);
      const chatId = customChatRef.id;

      // Clean poll options if applicable
      let cleanedPollOptions: string[] = [];
      const pollVotesObj: { [key: string]: number } = {};
      if (chatType === 'poll' || chatType === 'qa') {
        cleanedPollOptions = pollOptions.map(o => o.trim()).filter(o => o !== '');
        if (cleanedPollOptions.length < 2) {
          setChatError('At least 2 poll choices are mandatory.');
          setSendingChat(false);
          return;
        }
        cleanedPollOptions.forEach((_, idx) => {
          pollVotesObj[idx] = 0;
        });
      }

      const hash = generatePostHash();

      const payload: any = {
        id: chatId,
        communityId: activeCommunity.id,
        type: chatType,
        content: chatContent.trim(),
        createdAt: serverTimestamp(),
        createdByIp: deviceIp,
        createdByImei: deviceSig.value,
        encryptedHash: hash,
        likesCount: 0,
        reactions: { love: 0, fire: 0, laugh: 0, wow: 0, like: 0, angry: 0 },
        commentsCount: 0
      };

      if (chatImageUrl) payload.imageUrl = chatImageUrl;
      if (chatType === 'poll' || chatType === 'qa') {
        payload.pollOptions = cleanedPollOptions;
        payload.pollVotes = pollVotesObj;
      }
      if (chatType === 'qa' && qaCorrectIndex !== null) {
        payload.correctOptionIndex = qaCorrectIndex;
      }

      await setDoc(customChatRef, payload);

      // Reset active form
      setChatContent('');
      setChatImageUrl('');
      setChatImagePreview('');
      setPollOptions(['', '']);
      setQaCorrectIndex(null);
      setChatType('text');
    } catch (err: any) {
      setChatError('Failed to dispatch message.');
      handleFirestoreError(err, OperationType.WRITE, `communities/${activeCommunity.id}/chats`);
    } finally {
      setSendingChat(false);
    }
  };

  // Upvote/Downvote NOT allowed - only Like, Reaction, Comment (No vote indicators)
  const handleLikeChat = async (chatId: string) => {
    if (!activeCommunity) return;

    let isLiked = likedChats.includes(chatId);
    let updatedLikes = [...likedChats];

    try {
      const chatDocRef = doc(db, 'communities', activeCommunity.id, 'chats', chatId);

      if (isLiked) {
        updatedLikes = updatedLikes.filter(id => id !== chatId);
        await updateDoc(chatDocRef, { likesCount: increment(-1) });
      } else {
        updatedLikes.push(chatId);
        await updateDoc(chatDocRef, { likesCount: increment(1) });
      }

      setLikedChats(updatedLikes);
      localStorage.setItem('venom_liked_chats', JSON.stringify(updatedLikes));
    } catch (err: any) {
      console.error('Like action failed:', err);
    }
  };

  // React to a chat
  const handleReactChat = async (chatId: string, reactionKey: string) => {
    if (!activeCommunity) return;

    const previousReaction = userChatReactions[chatId];
    const updatedReactions = { ...userChatReactions };

    try {
      const chatDocRef = doc(db, 'communities', activeCommunity.id, 'chats', chatId);

      // Compute incremental update logic safely
      const reactionUpdate: { [key: string]: any } = {};

      if (previousReaction === reactionKey) {
        // Undo reaction
        delete updatedReactions[chatId];
        reactionUpdate[`reactions.${reactionKey}`] = increment(-1);
      } else {
        // Toggle or Add reaction
        updatedReactions[chatId] = reactionKey;
        if (previousReaction) {
          reactionUpdate[`reactions.${previousReaction}`] = increment(-1);
        }
        reactionUpdate[`reactions.${reactionKey}`] = increment(1);
      }

      await updateDoc(chatDocRef, reactionUpdate);
      setUserChatReactions(updatedReactions);
      localStorage.setItem('venom_chat_reactions', JSON.stringify(updatedReactions));
      setReactionMenuChatId(null);
    } catch (err) {
      console.error('Reaction failed:', err);
    }
  };

  // Submit Comments under community chats
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommunity || !commentingOnChat || !newCommentContent.trim()) return;

    setSubmittingComment(true);

    try {
      const commentsRef = collection(db, 'communities', activeCommunity.id, 'chats', commentingOnChat.id, 'comments');
      const customCommentRef = doc(commentsRef);
      const commentId = customCommentRef.id;

      const payload = {
        id: commentId,
        content: newCommentContent.trim(),
        createdAt: serverTimestamp(),
        createdByIp: deviceIp,
        createdByImei: deviceSig.value
      };

      await setDoc(customCommentRef, payload);

      // Increment commentsCount on parent chat
      const chatDocRef = doc(db, 'communities', activeCommunity.id, 'chats', commentingOnChat.id);
      await updateDoc(chatDocRef, { commentsCount: increment(1) });

      setNewCommentContent('');
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Submit report on a community (100 auto block threshold)
  const handleReportCommunity = async () => {
    if (!activeCommunity) return;

    const confirmReport = window.confirm('Are you absolutely sure you want to flag and report this community for policy violation?');
    if (!confirmReport) return;

    try {
      const commDocRef = doc(db, 'communities', activeCommunity.id);

      // Increment reportsCount
      const newReportCount = (activeCommunity.reportsCount || 0) + 1;
      
      const updatePayload: any = {
        reportsCount: increment(1)
      };

      if (newReportCount >= 100) {
        updatePayload.isBlocked = true;
      }

      await updateDoc(commDocRef, updatePayload);

      // Log the report in reports collection
      const reportRef = doc(collection(db, 'reports'));
      await setDoc(reportRef, {
        id: reportRef.id,
        communityId: activeCommunity.id,
        communityName: activeCommunity.name,
        reason: 'Community Violations (Flagged by Users)',
        opinion: 'Filer reporting illicit activities.',
        createdAt: new Date().toISOString(),
        ip: deviceIp,
        imei: deviceSig.value
      });

      alert(`Report submitted successfully. Current Flags: ${newReportCount}/100. Thank you for securing Obsidian.`);

      if (newReportCount >= 100) {
        alert('THRESHOLD EXCEEDED: This community has been automatically quarantined and blocked.');
        setActiveCommunity(null);
      }
    } catch (err) {
      console.error('Report submission failed:', err);
    }
  };

  // Share active chat deep-link
  const handleShareChat = (chatId: string) => {
    if (!activeCommunity) return;
    const shareLink = `${window.location.origin}/communities?communityId=${activeCommunity.id}&chatId=${chatId}`;
    
    navigator.clipboard.writeText(shareLink).then(() => {
      alert('COPILOT SYNC: Shared chat cryptographic deep link has been copied to your clipboard!');
    }).catch(() => {
      alert(`Link: ${shareLink}`);
    });
  };

  // Handle Poll Vote
  const handlePollVote = async (chatId: string, optionIdx: number) => {
    if (!activeCommunity || votedChatsPolls[chatId] !== undefined) return;

    try {
      const chatDocRef = doc(db, 'communities', activeCommunity.id, 'chats', chatId);
      const votePayload: { [key: string]: any } = {};
      votePayload[`pollVotes.${optionIdx}`] = increment(1);

      await updateDoc(chatDocRef, votePayload);

      const updatedVoted = { ...votedChatsPolls, [chatId]: optionIdx };
      setVotedChatsPolls(updatedVoted);
      localStorage.setItem('venom_voted_chats_polls', JSON.stringify(updatedVoted));
    } catch (err) {
      console.error('Failed to submit poll vote:', err);
    }
  };

  // Render sorting & filtering
  const sortedAndFilteredComms = communities
    .filter(c => {
      // 1. Filter blocked/quarantined communities
      if (c.isBlocked || (c.reportsCount || 0) >= 100) return false;

      // 2. Search query by Name, Description, and Religion/Area
      if (searchTerm.trim() !== '') {
        const queryTerm = searchTerm.toLowerCase();
        const matchesName = c.name?.toLowerCase().includes(queryTerm);
        const matchesDesc = c.description?.toLowerCase().includes(queryTerm);
        const matchesRel = c.religion?.toLowerCase().includes(queryTerm);
        return matchesName || matchesDesc || matchesRel;
      }

      // 3. Dropdown region filter
      if (filterRegion !== 'all' && c.religion !== filterRegion) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Pinned communities are prioritised at the very top
      const isPinnedA = pinnedIds.includes(a.id) ? 1 : 0;
      const isPinnedB = pinnedIds.includes(b.id) ? 1 : 0;
      if (isPinnedA !== isPinnedB) return isPinnedB - isPinnedA;

      if (sortBy === 'most_joined') {
        return (b.viewsCount || 0) - (a.viewsCount || 0);
      }
      if (sortBy === 'least_joined') {
        return (a.viewsCount || 0) - (b.viewsCount || 0);
      }

      // Latest default
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });

  // Extract list of all unique regions for the search filter
  const uniqueRegions = Array.from(new Set(communities.map(c => c.religion).filter(Boolean)));

  const handleOpenSettings = () => {
    if (!activeCommunity) return;
    setEditName(activeCommunity.name);
    setEditDesc(activeCommunity.description);
    setEditReligion(activeCommunity.religion);
    setEditUserLimit(activeCommunity.userLimit ? activeCommunity.userLimit.toString() : '');
    setEditAllowUserPost(activeCommunity.allowUserPost);
    setEditPassword(activeCommunity.password);
    setEditImageUrl(activeCommunity.imageUrl);
    setEditImagePreview(activeCommunity.imageUrl);
    setShowSettingsModal(true);
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-sans flex flex-col md:flex-row pb-20 md:pb-0" id="communities-page-viewport">
      
      {/* LEFT PANEL: COMMUNITIES FEED (Similar to Venom Main Feed) */}
      <div className={`w-full md:w-1/3 border-r border-zinc-900/60 bg-zinc-950 flex flex-col h-[calc(100vh-4rem)] md:h-screen ${activeCommunity ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Header & Launcher */}
        <div className="px-4 py-3 border-b border-zinc-900/80 flex items-center justify-between">
          <button 
            onClick={onBackToHome}
            className="flex items-center gap-1.5 text-xs font-mono font-bold text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>MAIN GRID</span>
          </button>
          
          <span className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/5 px-2.5 py-1 border border-emerald-500/10 rounded-full">
            COMMUNITIES
          </span>
        </div>

        {/* Search and Sort Section */}
        <div className="p-4 border-b border-zinc-900/80 space-y-3 shrink-0">
          
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by Name, Desc, Area..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-850 focus:border-emerald-500/40 rounded-lg pl-9 pr-4 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-3" />
          </div>

          <div className="flex items-center gap-1.5">
            {/* Sort controls */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-850 rounded px-2 py-1.5 text-[10px] font-mono font-bold text-zinc-400 focus:outline-none cursor-pointer hover:border-zinc-800 transition-colors"
            >
              <option value="latest">Sort: Latest</option>
              <option value="most_joined">Sort: Most Joined</option>
              <option value="least_joined">Sort: Least Joined</option>
            </select>

            {/* Filter region */}
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-850 rounded px-2 py-1.5 text-[10px] font-mono font-bold text-zinc-400 focus:outline-none cursor-pointer hover:border-zinc-800 transition-colors"
            >
              <option value="all">Region: All</option>
              {uniqueRegions.map((reg, i) => (
                <option key={i} value={reg}>{reg}</option>
              ))}
            </select>
          </div>

          {/* Create Button */}
          <button
            onClick={() => {
              if (!hasPostedAtLeastOnce) {
                alert('CLEARANCE DENIED: You must make at least 1 public Venom Post first to demonstrate active device utility before launching a private community.');
              } else {
                setShowCreateModal(true);
              }
            }}
            className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-sans font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 active:scale-98 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            <span>CREATE CYBER HUB</span>
          </button>
        </div>

        {/* Communities feed scroll list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 select-none">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 font-mono text-[10px]">
              <span className="animate-spin text-emerald-400 mb-2">●</span>
              <span>SYNCHRONISING DISPATCH GRID...</span>
            </div>
          ) : sortedAndFilteredComms.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-zinc-900 rounded-xl p-4 text-zinc-500 font-mono text-[10px]">
              <span>NO ACTIVE COGNITIVE COHORTS LOCATED</span>
            </div>
          ) : (
            sortedAndFilteredComms.map((comm) => {
              const isPinned = pinnedIds.includes(comm.id);
              return (
                <div
                  key={comm.id}
                  onClick={() => {
                    if (comm.password) {
                      setShowPasswordGate(comm);
                    } else {
                      handleEnterCommunityDirect(comm);
                    }
                  }}
                  className={`border rounded-xl p-3.5 bg-zinc-950/50 hover:bg-zinc-900/30 transition-all cursor-pointer relative group flex items-start gap-3.5 ${
                    isPinned ? 'border-emerald-500/20' : 'border-zinc-900'
                  }`}
                >
                  {/* Community Profile Image */}
                  <img
                    src={comm.imageUrl}
                    alt={comm.name}
                    className="w-12 h-12 rounded-xl object-cover bg-zinc-900 border border-zinc-800 shrink-0 shadow-inner group-hover:scale-105 transition-transform"
                    referrerPolicy="no-referrer"
                  />

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <h3 className="text-sm font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors truncate">
                        {comm.name}
                      </h3>
                      <div className="flex items-center gap-1">
                        {comm.password && <Lock className="w-3 h-3 text-emerald-400 shrink-0" />}
                        {isPinned && <Pin className="w-3 h-3 text-emerald-400 fill-emerald-400 shrink-0" />}
                      </div>
                    </div>

                    <p className="text-xs text-zinc-500 line-clamp-2 mt-1 leading-relaxed">
                      {comm.description}
                    </p>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[9px] font-mono bg-zinc-900 px-2 py-0.5 rounded text-zinc-400 flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5 text-emerald-500" />
                        <span>{comm.religion}</span>
                      </span>
                      <span className="text-[9px] font-mono bg-zinc-900 px-2 py-0.5 rounded text-zinc-400 flex items-center gap-1">
                        <Users className="w-2.5 h-2.5 text-emerald-500" />
                        <span>{comm.viewsCount || 0} Reviews</span>
                      </span>
                      {comm.userLimit && (
                        <span className="text-[9px] font-mono bg-zinc-900 px-2 py-0.5 rounded text-rose-400">
                          Limit: {comm.userLimit}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pin Toggle trigger floating overlay */}
                  <button
                    onClick={(e) => handleTogglePin(e, comm.id)}
                    className="absolute right-3.5 top-3.5 opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-emerald-400 transition-opacity"
                    title={isPinned ? 'Unpin community' : 'Pin community'}
                  >
                    <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL: CHATROOM WORKSPACE (WhatsApp styled) */}
      <div className={`flex-1 bg-zinc-950 flex flex-col h-[calc(100vh-4rem)] md:h-screen ${activeCommunity ? 'flex' : 'hidden md:flex items-center justify-center p-8 bg-[#020202]'}`}>
        
        {activeCommunity ? (
          <>
            {/* Top Workspace Header */}
            <div className="px-4 py-3 border-b border-zinc-900/80 bg-zinc-950 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile back trigger */}
                <button
                  onClick={() => setActiveCommunity(null)}
                  className="md:hidden p-1.5 border border-zinc-850 hover:border-zinc-700 bg-zinc-900 rounded text-zinc-400 cursor-pointer hover:text-emerald-400 transition-colors shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <img
                  src={activeCommunity.imageUrl}
                  alt={activeCommunity.name}
                  className="w-10 h-10 rounded-lg object-cover bg-zinc-900 border border-zinc-800 shrink-0"
                  referrerPolicy="no-referrer"
                />

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold text-zinc-100 truncate leading-none">
                      {activeCommunity.name}
                    </h2>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase leading-none bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-850">
                      {activeCommunity.religion}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 truncate mt-1">
                    {activeCommunity.description}
                  </p>
                </div>
              </div>

              {/* Header actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {activeCommunity.createdByImei === deviceSig.value && (
                  <button
                    onClick={handleOpenSettings}
                    className="p-2 border border-zinc-850 hover:border-emerald-500/20 rounded bg-zinc-900 text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer"
                    title="Community Dashboard Control"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={handleReportCommunity}
                  className="p-2 border border-zinc-850 hover:border-rose-500/30 rounded bg-zinc-900 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Report Community Guideline Violation"
                >
                  <Flag className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat message feed space */}
            <div 
              ref={chatListRef}
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-zinc-950 bg-[radial-gradient(#121212_1px,transparent_1px)] [background-size:16px_16px]"
            >
              {loadingChats ? (
                <div className="flex flex-col items-center justify-center py-24 text-zinc-500 font-mono text-[10px]">
                  <span className="animate-spin text-emerald-400 mb-2">●</span>
                  <span>SYNCING CRYPTO CHATS...</span>
                </div>
              ) : chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-zinc-500 font-mono text-[10px] space-y-2 max-w-sm mx-auto text-center leading-relaxed">
                  <BookOpen className="w-8 h-8 text-zinc-700" />
                  <span>GRID SECURELY INITIALISED</span>
                  <span>Welcome to the secure encryption pipeline. No dispatches have been posted here yet.</span>
                </div>
              ) : (
                chats.map((chat) => {
                  const isUserSender = chat.createdByImei === deviceSig.value;
                  const chatReaction = userChatReactions[chat.id];
                  const hasUserLiked = likedChats.includes(chat.id);

                  return (
                    <div
                      key={chat.id}
                      id={`chat-${chat.id}`}
                      className={`flex flex-col max-w-md md:max-w-xl border border-zinc-900 bg-zinc-950/60 p-3.5 rounded-2xl relative transition-all shadow-md group/chat ${
                        isUserSender ? 'ml-auto border-emerald-500/10 bg-emerald-500/[0.01]' : 'mr-auto'
                      }`}
                    >
                      {/* Top metadata tags */}
                      <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 mb-1.5 gap-4">
                        <span className="font-bold truncate text-zinc-400">
                          {isUserSender ? 'YOU (OWNER)' : `ANONYMOUS MEMBER (${chat.createdByIp || '0.0.0.0'})`}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded">
                            {chat.encryptedHash?.substring(0, 8)}
                          </span>
                        </div>
                      </div>

                      {/* Text content */}
                      {chat.content && (
                        <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed select-text">
                          {chat.content}
                        </p>
                      )}

                      {/* Image content */}
                      {chat.imageUrl && (
                        <div className="mt-2.5 rounded-lg overflow-hidden bg-zinc-900/60 border border-zinc-850 max-h-64 flex justify-center items-center">
                          <img
                            src={chat.imageUrl}
                            alt="Dispatch graphic"
                            className="w-full h-full object-contain cursor-zoom-in"
                            onClick={() => window.open(chat.imageUrl, '_blank')}
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      {/* Poll message type */}
                      {chat.type === 'poll' && chat.pollOptions && (
                        <div className="mt-3.5 space-y-2">
                          {chat.pollOptions.map((opt: string, idx: number) => {
                            const votes = chat.pollVotes?.[idx] || 0;
                            const totalVotes = Object.values(chat.pollVotes || {}).reduce((acc: any, curr: any) => acc + curr, 0) as number;
                            const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                            const isVoted = votedChatsPolls[chat.id] === idx;

                            return (
                              <button
                                key={idx}
                                disabled={votedChatsPolls[chat.id] !== undefined}
                                onClick={() => handlePollVote(chat.id, idx)}
                                className={`w-full relative text-left p-2.5 rounded-lg border text-xs font-sans flex items-center justify-between overflow-hidden cursor-pointer ${
                                  isVoted
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold'
                                    : 'bg-zinc-900/40 border-zinc-850 hover:bg-zinc-900 hover:border-zinc-800 text-zinc-400'
                                }`}
                              >
                                {/* Percentage fill bar */}
                                <div
                                  className="absolute top-0 left-0 bottom-0 bg-emerald-500/5 transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                                <span className="relative z-10">{opt}</span>
                                <span className="relative z-10 text-[10px] font-mono text-zinc-500">
                                  {votes} votes ({percentage}%)
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Q&A message type */}
                      {chat.type === 'qa' && chat.pollOptions && (
                        <div className="mt-3.5 space-y-2">
                          {chat.pollOptions.map((opt: string, idx: number) => {
                            const isCorrect = idx === chat.correctOptionIndex;
                            const isVoted = votedChatsPolls[chat.id] === idx;
                            const hasVotedAny = votedChatsPolls[chat.id] !== undefined;

                            return (
                              <button
                                key={idx}
                                disabled={hasVotedAny}
                                onClick={() => handlePollVote(chat.id, idx)}
                                className={`w-full text-left p-2.5 rounded-lg border text-xs font-sans flex items-center justify-between cursor-pointer ${
                                  hasVotedAny
                                    ? isCorrect
                                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-bold'
                                      : isVoted
                                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                                        : 'bg-zinc-900/40 border-zinc-900 text-zinc-600'
                                    : 'bg-zinc-900/40 border-zinc-850 hover:bg-zinc-900 hover:border-zinc-800 text-zinc-400'
                                }`}
                              >
                                <span>{opt}</span>
                                {hasVotedAny && isCorrect && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Micro interaction buttons row */}
                      <div className="mt-3.5 border-t border-zinc-900/60 pt-2.5 flex items-center gap-4 text-zinc-500 select-none">
                        
                        {/* Like icon */}
                        <button
                          onClick={() => handleLikeChat(chat.id)}
                          className={`flex items-center gap-1 text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                            hasUserLiked ? 'text-emerald-400' : 'hover:text-zinc-300'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${hasUserLiked ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                          <span>{chat.likesCount || 0}</span>
                        </button>

                        {/* Reaction Menu Button */}
                        <div className="relative">
                          <button
                            onClick={() => setReactionMenuChatId(reactionMenuChatId === chat.id ? null : chat.id)}
                            className="flex items-center gap-1 text-[10px] font-mono font-bold hover:text-zinc-300 transition-colors cursor-pointer"
                          >
                            <span>{chatReaction ? REACTIONS.find(r => r.key === chatReaction)?.emoji : '😊'}</span>
                            <span className="text-[9px] uppercase tracking-wider font-mono">React</span>
                          </button>

                          {/* Float Reaction Menu Popup */}
                          <AnimatePresence>
                            {reactionMenuChatId === chat.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setReactionMenuChatId(null)} />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.9, y: 5 }}
                                  className="absolute bottom-6 left-0 z-50 bg-zinc-900 border border-zinc-800 p-1.5 rounded-full flex gap-1 shadow-2xl"
                                >
                                  {REACTIONS.map((r) => (
                                    <button
                                      key={r.key}
                                      onClick={() => handleReactChat(chat.id, r.key)}
                                      className="hover:scale-125 transition-transform p-1 text-base cursor-pointer"
                                      title={r.key}
                                    >
                                      {r.emoji}
                                    </button>
                                  ))}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Display Active Reactions counts under message card */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {REACTIONS.map((r) => {
                            const count = chat.reactions?.[r.key] || 0;
                            if (count <= 0) return null;
                            return (
                              <span key={r.key} className="text-[10px] bg-zinc-900/60 border border-zinc-850 px-1 py-0.5 rounded flex items-center gap-0.5">
                                <span>{r.emoji}</span>
                                <span className="text-zinc-500 font-bold">{count}</span>
                              </span>
                            );
                          })}
                        </div>

                        {/* Comments button */}
                        <button
                          onClick={() => setCommentingOnChat(chat)}
                          className="flex items-center gap-1 text-[10px] font-mono font-bold hover:text-zinc-300 transition-colors ml-auto cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{chat.commentsCount || 0}</span>
                        </button>

                        {/* Share button */}
                        <button
                          onClick={() => handleShareChat(chat.id)}
                          className="p-1 text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Share Chat Cryptographic Link"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Time tag (neatly formatted, bottom group-hover display) */}
                      <span className="text-[8px] font-mono text-zinc-600 absolute right-3 bottom-1 opacity-0 group-hover/chat:opacity-100 transition-opacity">
                        {chat.createdAt ? new Date(chat.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Bottom active entry messaging panel (WhatsApp styled) */}
            <form onSubmit={handleSendChatSubmit} className="p-3 border-t border-zinc-900 bg-zinc-950 flex flex-col shrink-0 gap-2 relative">
              {chatError && (
                <div className="absolute top-0 left-0 right-0 -translate-y-full bg-rose-950/25 border-t border-rose-500/20 text-rose-400 text-[10px] py-1.5 px-4 z-20 flex justify-between items-center leading-relaxed">
                  <span>[WARNING]: {chatError}</span>
                  <button type="button" onClick={() => setChatError('')} className="p-0.5 text-zinc-500 hover:text-rose-400 cursor-pointer"><X className="w-3 h-3" /></button>
                </div>
              )}

              {/* Chat Format Selection Bar */}
              <div className="flex items-center gap-1 border-b border-zinc-900/60 pb-2">
                <span className="text-[9px] font-mono text-zinc-500 uppercase font-bold tracking-wider mr-2">FORMAT:</span>
                {(['text', 'image', 'poll', 'qa'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => { setChatType(fmt); setChatError(''); }}
                    className={`px-2.5 py-1 text-[9px] font-mono font-bold uppercase rounded border transition-all cursor-pointer ${
                      chatType === fmt
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-zinc-900/40 border-zinc-900 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              {/* Collapsible Format Settings Panels */}
              {chatType === 'image' && (
                <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-900 space-y-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-950 border border-zinc-850 rounded text-xs font-mono font-bold text-zinc-400 hover:text-emerald-400 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <ImageIcon className="w-4 h-4 text-emerald-500" />
                      <span>ATTACH DEVICE GRAPHIC</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFileChange(e, 'chat')}
                      className="hidden"
                    />

                    {chatImagePreview && (
                      <div className="relative">
                        <img src={chatImagePreview} alt="Preview" className="w-12 h-12 rounded object-cover border border-zinc-800" />
                        <button
                          type="button"
                          onClick={() => { setChatImagePreview(''); setChatImageUrl(''); }}
                          className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 rounded-full p-0.5 text-zinc-950 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {chatType === 'poll' && (
                <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-900 space-y-3">
                  <span className="text-[9px] font-mono font-bold text-zinc-500 block uppercase">POLL CONFIGURATION</span>
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-zinc-600 w-4">{i + 1}</span>
                      <input
                        type="text"
                        placeholder={`Option ${i + 1} desc...`}
                        value={opt}
                        onChange={(e) => {
                          const updated = [...pollOptions];
                          updated[i] = e.target.value;
                          setPollOptions(updated);
                        }}
                        className="flex-1 bg-zinc-900 border border-zinc-850 rounded px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...pollOptions];
                            updated.splice(i, 1);
                            setPollOptions(updated);
                          }}
                          className="p-1.5 text-rose-400 hover:bg-rose-950/15 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 5 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions([...pollOptions, ''])}
                      className="text-[10px] font-mono font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>ADD CHOICE</span>
                    </button>
                  )}
                </div>
              )}

              {chatType === 'qa' && (
                <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-900 space-y-3">
                  <span className="text-[9px] font-mono font-bold text-zinc-500 block uppercase">Q&A QUESTION CONFIG (SELECT THE CORRECT ANSWER ROW)</span>
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQaCorrectIndex(i)}
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 cursor-pointer ${
                          qaCorrectIndex === i
                            ? 'bg-emerald-500 border-emerald-500 text-zinc-950'
                            : 'border-zinc-800 bg-zinc-900 text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3 stroke-[3px]" />
                      </button>
                      <input
                        type="text"
                        placeholder={`QA Option ${i + 1} desc...`}
                        value={opt}
                        onChange={(e) => {
                          const updated = [...pollOptions];
                          updated[i] = e.target.value;
                          setPollOptions(updated);
                        }}
                        className="flex-1 bg-zinc-900 border border-zinc-850 rounded px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...pollOptions];
                            updated.splice(i, 1);
                            setPollOptions(updated);
                            if (qaCorrectIndex === i) setQaCorrectIndex(null);
                          }}
                          className="p-1.5 text-rose-400 hover:bg-rose-950/15 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 4 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions([...pollOptions, ''])}
                      className="text-[10px] font-mono font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>ADD ANSWER CHOICE</span>
                    </button>
                  )}
                </div>
              )}

              {/* Message Input Box Row */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={
                    chatType === 'poll'
                      ? 'Ask a polling question...'
                      : chatType === 'qa'
                        ? 'Ask a Q&A question...'
                        : 'Encrypt private message...'
                  }
                  value={chatContent}
                  onChange={(e) => setChatContent(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-850 focus:border-emerald-500/40 rounded-xl px-4 py-2.5 text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none transition-colors"
                />

                <button
                  type="submit"
                  disabled={sendingChat}
                  className="p-2.5 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 active:scale-95 disabled:opacity-50 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-emerald-950/20"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center mx-auto text-emerald-400">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xs font-black tracking-widest text-zinc-300 uppercase">VENOM NETWORKS CHANNELS</h3>
            <p className="text-[10px] text-zinc-500 uppercase max-w-xs mx-auto leading-relaxed">
              Connect anonymously with group cohorts across isolated regions. Select an active private community to link encryption.
            </p>
          </div>
        )}
      </div>

      {/* CREATE COMMUNITY MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="fixed inset-0" onClick={() => setShowCreateModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-zinc-900 rounded-2xl max-w-md w-full p-5 shadow-2xl relative z-10"
            >
              <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3 mb-4">
                <span className="text-xs font-mono font-black text-emerald-400 uppercase tracking-widest">
                  SEED CYBER COMMUNITY
                </span>
                <button onClick={() => setShowCreateModal(false)} className="p-1 text-zinc-500 hover:text-zinc-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {cError && (
                <div className="bg-rose-950/20 border border-rose-500/20 text-rose-400 text-[10px] p-2.5 rounded mb-4 font-mono leading-relaxed">
                  [GATE KEEPER ALERT]: {cError}
                </div>
              )}

              <form onSubmit={handleCreateCommunitySubmit} className="space-y-4">
                
                {/* Profile Image selector & upload */}
                <div>
                  <label className="text-[9px] font-mono font-bold text-zinc-500 block uppercase tracking-wider mb-2">COMMUNITY LOGO PICTURE</label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-950 border border-zinc-850 rounded-lg text-[10px] font-mono font-bold text-zinc-400 hover:text-emerald-400 transition-all cursor-pointer"
                    >
                      UPLOAD LOGO
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFileChange(e, 'create')}
                      className="hidden"
                    />

                    {cImagePreview ? (
                      <img src={cImagePreview} alt="Logo preview" className="w-12 h-12 rounded-xl object-cover border border-zinc-800" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-600 text-xs font-mono">
                        EMPTY
                      </div>
                    )}
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 block uppercase tracking-wider">COHORT NAME</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter unique community name..."
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 block uppercase tracking-wider">SECURE GRID DESCRIPTION</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Briefly describe community intent..."
                    value={cDesc}
                    onChange={(e) => setCDesc(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700 resize-none"
                  />
                </div>

                {/* Religion / Area */}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 block uppercase tracking-wider">RELIGION (COUNTRY / CONTINENT OR WORLD AREA)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Asia, Europe, USA, Global..."
                    value={cReligion}
                    onChange={(e) => setCReligion(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700"
                  />
                </div>

                {/* Limits and Password Options (Side by Side) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-zinc-500 block uppercase tracking-wider">USER LIMIT (OPTIONAL)</label>
                    <input
                      type="number"
                      placeholder="Unlimited if blank"
                      value={cUserLimit}
                      onChange={(e) => setCUserLimit(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-zinc-500 block uppercase tracking-wider">PIN PASSWORD (OPTIONAL)</label>
                    <input
                      type="password"
                      placeholder="No gateway lock"
                      value={cPassword}
                      onChange={(e) => setCPassword(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700"
                    />
                  </div>
                </div>

                {/* Who can post */}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 block uppercase tracking-wider">PERMISSIONS LAYER</label>
                  <select
                    value={cAllowUserPost ? 'all' : 'owner'}
                    onChange={(e) => setCAllowUserPost(e.target.value === 'all')}
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none"
                  >
                    <option value="all">Users can also Post</option>
                    <option value="owner">User cannot post (Owner only dispatches)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={cSubmitting}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-sans font-black text-xs rounded-lg uppercase mt-4 tracking-widest transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-950/20"
                >
                  {cSubmitting ? 'DISPATCHING SEED PIXEL...' : 'SEED CYBER NETWORK'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT/SETTINGS COMMUNITY MODAL (Owner only) */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="fixed inset-0" onClick={() => setShowSettingsModal(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-zinc-900 rounded-2xl max-w-md w-full p-5 shadow-2xl relative z-10"
            >
              <div className="flex items-center justify-between border-b border-zinc-900/60 pb-3 mb-4">
                <span className="text-xs font-mono font-black text-emerald-400 uppercase tracking-widest">
                  COMMUNITY DATA CONSOLE
                </span>
                <button onClick={() => setShowSettingsModal(false)} className="p-1 text-zinc-500 hover:text-zinc-200 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editError && (
                <div className="bg-rose-950/20 border border-rose-500/20 text-rose-400 text-[10px] p-2.5 rounded mb-4 font-mono">
                  [ERROR]: {editError}
                </div>
              )}

              <form onSubmit={handleUpdateSettingsSubmit} className="space-y-4">
                
                {/* Logo */}
                <div>
                  <label className="text-[9px] font-mono font-bold text-zinc-500 block uppercase tracking-wider mb-2">UPDATE COMMUNITY IMAGE</label>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-950 border border-zinc-850 rounded-lg text-[10px] font-mono font-bold text-zinc-400 hover:text-emerald-400 transition-all cursor-pointer"
                    >
                      CHOOSE IMAGE
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFileChange(e, 'edit')}
                      className="hidden"
                    />

                    {editImagePreview ? (
                      <img src={editImagePreview} alt="Logo preview" className="w-12 h-12 rounded-xl object-cover border border-zinc-800" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-600 text-xs font-mono">
                        EMPTY
                      </div>
                    )}
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 block uppercase tracking-wider">COHORT NAME</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter community name..."
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 block uppercase tracking-wider">SECURE GRID DESCRIPTION</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Describe intent..."
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none resize-none"
                  />
                </div>

                {/* Religion / Area */}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 block uppercase tracking-wider">RELIGION (COUNTRY / CONTINENT OR WORLD AREA)</label>
                  <input
                    type="text"
                    required
                    placeholder="Area location..."
                    value={editReligion}
                    onChange={(e) => setEditReligion(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none"
                  />
                </div>

                {/* Limit & Password */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-zinc-500 block uppercase tracking-wider">USER LIMIT</label>
                    <input
                      type="number"
                      placeholder="Unlimited"
                      value={editUserLimit}
                      onChange={(e) => setEditUserLimit(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-zinc-500 block uppercase tracking-wider">PIN PASSWORD</label>
                    <input
                      type="password"
                      placeholder="No lock"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Who can post */}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-zinc-500 block uppercase tracking-wider">PERMISSIONS LAYER</label>
                  <select
                    value={editAllowUserPost ? 'all' : 'owner'}
                    onChange={(e) => setEditAllowUserPost(e.target.value === 'all')}
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none"
                  >
                    <option value="all">Users can also Post</option>
                    <option value="owner">User cannot post (Owner only)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-sans font-black text-xs rounded-lg uppercase mt-4 tracking-widest transition-all cursor-pointer disabled:opacity-50"
                >
                  {editSubmitting ? 'SAVING DATA CONSOLE...' : 'UPDATE COHORT DATA'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PASSWORD GATE MODAL */}
      <AnimatePresence>
        {showPasswordGate && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0" onClick={() => setShowPasswordGate(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-950 border border-zinc-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative z-10 text-center"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center mx-auto mb-3 text-emerald-400">
                <Lock className="w-5 h-5 animate-pulse" />
              </div>

              <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-1">DECRYPTION AUTH REQUIRED</h3>
              <p className="text-[10px] text-zinc-500 uppercase leading-relaxed max-w-xs mx-auto mb-4">
                This community channel is locked behind a security password. Input passkey to link.
              </p>

              {gateError && (
                <div className="bg-rose-950/20 border border-rose-500/20 text-rose-400 text-[9px] p-2.5 rounded mb-4 font-mono leading-relaxed">
                  {gateError}
                </div>
              )}

              <form onSubmit={handlePasswordGateSubmit} className="space-y-4">
                <input
                  type="password"
                  required
                  placeholder="Enter pin passkey..."
                  value={gatePasswordInput}
                  onChange={(e) => setGatePasswordInput(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded-lg px-3 py-2.5 text-center text-sm text-zinc-300 focus:outline-none tracking-widest"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordGate(null)}
                    className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-md shadow-emerald-950/10"
                  >
                    DECRYPT HUB
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INLINE COMMENTS SLIDEOUT DRAWER / OVERLAY PANEL */}
      <AnimatePresence>
        {commentingOnChat && (
          <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-zinc-950 border-l border-zinc-900/80 z-50 flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950 shrink-0">
              <span className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest">
                CHAT DEBATE PIPELINE
              </span>
              <button
                onClick={() => setCommentingOnChat(null)}
                className="p-1 text-zinc-500 hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target comment preview */}
            <div className="p-4 bg-zinc-900/25 border-b border-zinc-900/60 shrink-0 text-xs text-zinc-400 max-h-32 overflow-y-auto">
              <span className="text-[8px] font-mono text-zinc-600 block mb-1">ORIGINAL MESSAGE DISPATCH</span>
              {commentingOnChat.content}
            </div>

            {/* Comment List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatComments.length === 0 ? (
                <div className="text-center py-12 text-zinc-600 font-mono text-[9px] uppercase">
                  No cohort statements recorded
                </div>
              ) : (
                chatComments.map((comm) => (
                  <div key={comm.id} className="p-3 border border-zinc-900 rounded-xl bg-zinc-950/80 space-y-1.5">
                    <div className="flex justify-between items-center text-[8px] font-mono text-zinc-500">
                      <span>{comm.createdByImei === deviceSig.value ? 'YOU' : `MEMBER (${comm.createdByIp})`}</span>
                      <span>{comm.createdAt ? new Date(comm.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {comm.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSendComment} className="p-4 border-t border-zinc-900 bg-zinc-950 shrink-0 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Formulate encrypted rebuttal..."
                  required
                  value={newCommentContent}
                  onChange={(e) => setNewCommentContent(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-850 focus:border-emerald-500/30 rounded-xl px-3.5 py-2 text-xs text-zinc-300 focus:outline-none placeholder-zinc-700"
                />
                <button
                  type="submit"
                  disabled={submittingComment}
                  className="p-2 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
