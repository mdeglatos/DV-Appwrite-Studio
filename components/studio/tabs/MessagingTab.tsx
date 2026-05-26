import React, { useState, useEffect } from 'react';
import type { AppwriteProject, MessageProvider, MessageTopic, MessageSubscriber } from '../../../types';
import { getSdkMessaging, ID, Query } from '../../../services/appwrite';
import { MessageIcon, AddIcon, DeleteIcon, LoadingSpinnerIcon, ExternalLinkIcon, PlayIcon, EmailVerifiedIcon, PhoneIcon, BotIcon } from '../../Icons';
import { consoleLinks } from '../../../services/appwrite';
import { useToast } from '../../../hooks/useToast';
import { ConfirmationModal } from '../../ConfirmationModal';

interface MessagingTabProps {
    activeProject: AppwriteProject;
}

export const MessagingTab: React.FC<MessagingTabProps> = ({ activeProject }) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [providers, setProviders] = useState<MessageProvider[]>([]);
    const [topics, setTopics] = useState<MessageTopic[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<MessageTopic | null>(null);
    const [subscribers, setSubscribers] = useState<MessageSubscriber[]>([]);
    const [subscribersLoading, setSubscribersLoading] = useState(false);

    // Form inputs state
    const [newTopicId, setNewTopicId] = useState('');
    const [newTopicName, setNewTopicName] = useState('');
    const [isCreatingTopic, setIsCreatingTopic] = useState(false);

    // Confirmation Modal state
    const [confirmation, setConfirmation] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    } | null>(null);

    const [newSubId, setNewSubId] = useState('');
    const [newSubTarget, setNewSubTarget] = useState('');
    const [isCreatingSub, setIsCreatingSub] = useState(false);

    // Broadcast composer state
    const [messageChannel, setMessageChannel] = useState<'email' | 'sms' | 'push'>('email');
    const [emailSubject, setEmailSubject] = useState('');
    const [msgContent, setMsgContent] = useState('');
    const [pushTitle, setPushTitle] = useState('');
    const [pushBody, setPushBody] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Load Messaging resources
    const loadMessagingData = async () => {
        setIsLoading(true);
        try {
            const sdk = getSdkMessaging(activeProject);
            const [providersRes, topicsRes] = await Promise.all([
                sdk.listProviders().catch(() => ({ providers: [] })),
                sdk.listTopics().catch(() => ({ topics: [] }))
            ]);
            setProviders(providersRes.providers as any[] || []);
            setTopics(topicsRes.topics as any[] || []);
        } catch (e: any) {
            toast.error(`Messaging API Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadMessagingData();
        setSelectedTopic(null);
        setSubscribers([]);
    }, [activeProject]);

    // Load subscribers for selected topic
    const loadSubscribers = async (topic: MessageTopic) => {
        setSubscribersLoading(true);
        try {
            const sdk = getSdkMessaging(activeProject);
            const response = await sdk.listSubscribers(topic.$id);
            setSubscribers(response.subscribers as any[] || []);
        } catch (e: any) {
            toast.error(`Could not fetch subscribers: ${e.message}`);
        } finally {
            setSubscribersLoading(false);
        }
    };

    const handleSelectTopic = (topic: MessageTopic) => {
        setSelectedTopic(topic);
        loadSubscribers(topic);
    };

    // Topic handlers
    const handleCreateTopic = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTopicName) return;
        setIsCreatingTopic(true);
        try {
            const sdk = getSdkMessaging(activeProject);
            const topicIdToUse = newTopicId.trim() || ID.unique();
            const newTopic = await sdk.createTopic(topicIdToUse, newTopicName);
            setTopics([...topics, newTopic as any]);
            setNewTopicId('');
            setNewTopicName('');
            toast.success(`Successfully created topic: ${newTopicName}`);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsCreatingTopic(false);
        }
    };

    const handleDeleteTopic = (topicId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmation({
            isOpen: true,
            title: 'Delete Topic',
            message: 'Are you sure you want to deregister and delete this broadcast topic?',
            onConfirm: async () => {
                try {
                    const sdk = getSdkMessaging(activeProject);
                    await sdk.deleteTopic(topicId);
                    setTopics(prev => prev.filter(t => t.$id !== topicId));
                    if (selectedTopic?.$id === topicId) {
                        setSelectedTopic(null);
                        setSubscribers([]);
                    }
                    toast.success('Successfully deleted topic.');
                } catch (err: any) {
                    toast.error(err.message);
                }
            }
        });
    };

    // Subscriber handlers
    const handleCreateSubscriber = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTopic || !newSubTarget) return;
        setIsCreatingSub(true);
        try {
            const sdk = getSdkMessaging(activeProject);
            const subIdToUse = newSubId.trim() || ID.unique();
            const newSub = await sdk.createSubscriber(selectedTopic.$id, subIdToUse, newSubTarget);
            setSubscribers([...subscribers, newSub as any]);
            setNewSubId('');
            setNewSubTarget('');
            toast.success('Subscribed target successfully!');
            // Refresh topic subscriber count in listing
            setTopics(topics.map(t => t.$id === selectedTopic.$id ? { ...t, subscribersCount: t.subscribersCount + 1 } : t));
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setIsCreatingSub(false);
        }
    };

    const handleDeleteSubscriber = (subId: string) => {
        if (!selectedTopic) return;
        setConfirmation({
            isOpen: true,
            title: 'Unsubscribe Target',
            message: 'Are you sure you want to unsubscribe this target from the topic?',
            onConfirm: async () => {
                try {
                    const sdk = getSdkMessaging(activeProject);
                    await sdk.deleteSubscriber(selectedTopic.$id, subId);
                    setSubscribers(prev => prev.filter(s => s.$id !== subId));
                    toast.success('Successfully unsubscribed target.');
                    // Refresh topic subscriber count in listing
                    setTopics(prev => prev.map(t => t.$id === selectedTopic.$id ? { ...t, subscribersCount: Math.max(0, t.subscribersCount - 1) } : t));
                } catch (err: any) {
                    toast.error(err.message);
                }
            }
        });
    };

    // Send dispatch campaign handler
    const handleSendBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTopic) {
            toast.error('Please select a target topic to broadcast to.');
            return;
        }
        setIsSending(true);
        try {
            const sdk = getSdkMessaging(activeProject);
            const msgId = ID.unique();
            let response;
            
            if (messageChannel === 'email') {
                if (!emailSubject || !msgContent) throw new Error('Subject and body content required.');
                response = await sdk.createEmail(msgId, emailSubject, msgContent, [selectedTopic.$id]);
            } else if (messageChannel === 'sms') {
                if (!msgContent) throw new Error('SMS message body content required.');
                response = await sdk.createSms(msgId, msgContent, [selectedTopic.$id]);
            } else {
                if (!pushTitle || !pushBody) throw new Error('Push title and body alert required.');
                response = await sdk.createPush(msgId, pushTitle, pushBody, [selectedTopic.$id]);
            }

            toast.success(`Successfully queued ${messageChannel} campaign broadcast.`);
            setEmailSubject('');
            setMsgContent('');
            setPushTitle('');
            setPushBody('');
        } catch (err: any) {
            toast.error(`Broadcast failed: ${err.message}`);
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <LoadingSpinnerIcon size={32} className="text-cyan-400 animate-spin" />
                <p className="text-gray-400 text-sm">Loading Messaging interface...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                        <MessageIcon size={24} className="text-cyan-400" />
                        Unified Messaging Suite
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Configure notification providers, manage subscription topics, and dispatch push, email, and SMS campaigns.</p>
                </div>
                <a 
                    href={consoleLinks.overview(activeProject) + '/messaging'} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900/60 hover:bg-gray-800 border border-white/5 rounded-xl text-xs font-bold text-gray-300 transition-all shadow-inner"
                >
                    <ExternalLinkIcon size={14} /> Open in Console
                </a>
            </div>

            {/* Providers check */}
            <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md">
                <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest mb-3.5">Active Service Providers</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {providers.length === 0 ? (
                        <div className="col-span-4 text-xs text-gray-500 italic py-2">
                            No third-party messaging providers configured. Go to your Appwrite console settings to register APNs, FCM, SMTP, or Twilio keys.
                        </div>
                    ) : (
                        providers.map(prov => (
                            <div key={prov.$id} className="bg-gray-950/40 border border-white/5 rounded-xl p-4 flex items-center gap-3.5">
                                <div className="p-2.5 bg-gray-900 rounded-lg text-cyan-400">
                                    {prov.type === 'email' ? <EmailVerifiedIcon size={18} /> : prov.type === 'sms' ? <PhoneIcon size={18} /> : <BotIcon size={18} />}
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-gray-200">{prov.name}</div>
                                    <div className="text-[10px] text-gray-500 capitalize">{prov.provider} ({prov.type})</div>
                                </div>
                                <div className="ml-auto">
                                    <span className={`w-2.5 h-2.5 rounded-full block ${prov.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-700'}`} title={prov.enabled ? 'Active' : 'Disabled'} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Topics & Campaign Composer */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Topics Selector Panel */}
                <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md flex flex-col h-[520px]">
                    <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest mb-4">Subscription Topics</h2>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                        {topics.length === 0 ? (
                            <div className="text-xs text-gray-500 italic py-4 text-center">No broadcast topics registered. Create one below.</div>
                        ) : (
                            topics.map(t => (
                                <div
                                    key={t.$id}
                                    onClick={() => handleSelectTopic(t)}
                                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                        selectedTopic?.$id === t.$id
                                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                                            : 'bg-gray-950/20 border-white/5 text-gray-400 hover:text-gray-200 hover:bg-gray-950/40'
                                    }`}
                                >
                                    <div>
                                        <div className="text-xs font-bold">{t.name}</div>
                                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">{t.$id}</div>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-[10px] font-semibold bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full border border-white/5">
                                            {t.subscribersCount} Sub
                                        </span>
                                        <button onClick={(e) => handleDeleteTopic(t.$id, e)} className="text-gray-500 hover:text-red-400 p-0.5" title="Delete Topic">
                                            <DeleteIcon size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <form onSubmit={handleCreateTopic} className="border-t border-white/5 pt-4 mt-4 space-y-2.5 flex-shrink-0">
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="text"
                                placeholder="Topic ID"
                                className="bg-gray-950 border border-white/5 rounded-xl p-2 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                                value={newTopicId}
                                onChange={e => setNewTopicId(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Topic Name"
                                className="bg-gray-950 border border-white/5 rounded-xl p-2 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
                                value={newTopicName}
                                onChange={e => setNewTopicName(e.target.value)}
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isCreatingTopic}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-500 font-semibold rounded-xl text-white text-xs transition-colors shadow-inner"
                        >
                            {isCreatingTopic ? <LoadingSpinnerIcon size={12} className="animate-spin" /> : <AddIcon size={12} />}
                            Create Topic
                        </button>
                    </form>
                </div>

                {/* 2. Campaign Composer & Subscribers List */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedTopic ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[520px]">
                            {/* Subscribers list for selected topic */}
                            <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md flex flex-col h-full">
                                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-3">
                                    Subscribers in: <span className="text-cyan-400 font-semibold lowercase font-mono">{selectedTopic.name}</span>
                                </h3>

                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                                    {subscribersLoading ? (
                                        <div className="flex justify-center items-center py-10">
                                            <LoadingSpinnerIcon size={20} className="animate-spin text-cyan-400" />
                                        </div>
                                    ) : subscribers.length === 0 ? (
                                        <div className="text-xs text-gray-500 italic text-center py-10">No active subscribers targeting this topic channel. Add a subscriber below.</div>
                                    ) : (
                                        subscribers.map(sub => (
                                            <div key={sub.$id} className="bg-gray-950/40 border border-white/5 rounded-xl p-3 flex items-center justify-between text-xs text-gray-300">
                                                <div>
                                                    <div className="font-mono text-[10px] text-gray-500">Sub ID: {sub.$id}</div>
                                                    <div className="font-semibold text-gray-200 mt-0.5">Target: {sub.target || 'device token'}</div>
                                                </div>
                                                <button onClick={() => handleDeleteSubscriber(sub.$id)} className="text-gray-500 hover:text-red-400 p-0.5" title="Unsubscribe">
                                                    <DeleteIcon size={12} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <form onSubmit={handleCreateSubscriber} className="border-t border-white/5 pt-4 mt-4 space-y-2.5 flex-shrink-0">
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            placeholder="Subscriber ID (Optional)"
                                            className="bg-gray-950 border border-white/5 rounded-xl p-2 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                                            value={newSubId}
                                            onChange={e => setNewSubId(e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Target ID (e.g. email, phone ID)"
                                            className="bg-gray-950 border border-white/5 rounded-xl p-2 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                                            value={newSubTarget}
                                            onChange={e => setNewSubTarget(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isCreatingSub}
                                        className="w-full flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-500 font-semibold rounded-xl text-white text-xs transition-colors shadow-inner"
                                    >
                                        {isCreatingSub ? <LoadingSpinnerIcon size={12} className="animate-spin" /> : <AddIcon size={12} />}
                                        Add Subscriber Target
                                    </button>
                                </form>
                            </div>

                            {/* Campaign Composer */}
                            <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md flex flex-col h-full">
                                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-4">Campaign Composer</h3>
                                
                                <form onSubmit={handleSendBroadcast} className="flex-1 flex flex-col justify-between">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-1.5">Dispatch Channel</label>
                                            <div className="grid grid-cols-3 gap-2 bg-gray-950 p-1.5 rounded-xl border border-white/5">
                                                {(['email', 'sms', 'push'] as const).map(ch => (
                                                    <button
                                                        key={ch}
                                                        type="button"
                                                        onClick={() => setMessageChannel(ch)}
                                                        className={`py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                                            messageChannel === ch
                                                                ? 'bg-gray-900 text-cyan-400 shadow-md border border-white/5'
                                                                : 'text-gray-500 hover:text-gray-300'
                                                        }`}
                                                    >
                                                        {ch}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {messageChannel === 'email' && (
                                            <div>
                                                <label className="block text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-1">Subject</label>
                                                <input
                                                    type="text"
                                                    placeholder="E.g., Welcome to our service!"
                                                    className="w-full bg-gray-950 border border-white/5 rounded-xl p-2.5 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-cyan-500"
                                                    value={emailSubject}
                                                    onChange={e => setEmailSubject(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        )}

                                        {messageChannel === 'push' && (
                                            <div>
                                                <label className="block text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-1">Push Title</label>
                                                <input
                                                    type="text"
                                                    placeholder="E.g., Alert: New Activity"
                                                    className="w-full bg-gray-950 border border-white/5 rounded-xl p-2.5 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-cyan-500"
                                                    value={pushTitle}
                                                    onChange={e => setPushTitle(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-[10px] uppercase font-semibold text-gray-500 tracking-wider mb-1">
                                                {messageChannel === 'push' ? 'Notification Alert Body' : 'Message Content Body'}
                                            </label>
                                            <textarea
                                                placeholder={messageChannel === 'sms' ? 'Keep SMS messages under 160 characters for best delivery...' : 'Write message content details... Support plaintext or markup depending on configuration.'}
                                                className="w-full bg-gray-950 border border-white/5 rounded-xl p-2.5 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-cyan-500 h-28 custom-scrollbar resize-none"
                                                value={messageChannel === 'push' ? pushBody : msgContent}
                                                onChange={e => messageChannel === 'push' ? setPushBody(e.target.value) : setMsgContent(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSending}
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-600 hover:bg-cyan-500 font-semibold rounded-xl text-white text-xs transition-colors shadow-inner mt-4"
                                    >
                                        {isSending ? <LoadingSpinnerIcon size={14} className="animate-spin" /> : <PlayIcon size={14} />}
                                        Broadcast Campaign
                                    </button>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-md flex flex-col justify-center items-center text-center h-[520px] gap-2 text-gray-500">
                            <MessageIcon size={40} className="text-gray-600 mb-2" />
                            <div className="text-sm font-semibold">No Topic Selected</div>
                            <p className="text-xs max-w-xs">Select a broadcast topic subscription channel on the left to manage subscribers and compose campaign dispatches.</p>
                        </div>
                    )}
                </div>
            </div>
            {confirmation && (
                <ConfirmationModal
                    isOpen={confirmation.isOpen}
                    title={confirmation.title}
                    message={confirmation.message}
                    onConfirm={() => {
                        confirmation.onConfirm();
                        setConfirmation(null);
                    }}
                    onClose={() => setConfirmation(null)}
                />
            )}
        </div>
    );
};
