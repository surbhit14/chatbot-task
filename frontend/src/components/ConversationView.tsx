import { useEffect, useRef, useState } from 'react';
import { ConversationDetail, Message } from '../types';
import { cancelConversation, getConversation, streamMessage } from '../api/client';
import { MessageBubble } from './MessageBubble';
import { StreamingBubble } from './StreamingBubble';
import { MODELS, DEFAULT_MODEL } from '../constants/models';

interface Props {
  conversationId: string;
  onStatusChange: () => void;
}

export function ConversationView({ conversationId, onStatusChange }: Props) {
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConv(null);
    setMessages([]);
    setStreamingContent('');
    setError(null);
    setInput('');

    getConversation(conversationId)
      .then((data) => {
        setConv(data);
        setMessages(data.messages);
      })
      .catch(() => setError('Failed to load conversation'));
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  async function handleSend() {
    if (!input.trim() || streaming || conv?.status !== 'active') return;

    const text = input.trim();
    setInput('');
    setError(null);

    const optimisticUser: Message = {
      id: `optimistic-${Date.now()}`,
      role: 'user',
      content: text,
      sequence_num: messages.length + 1,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setStreaming(true);
    setStreamingContent('');

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = '';

    try {
      await streamMessage(
        conversationId,
        text,
        (delta) => {
          accumulated += delta;
          setStreamingContent(accumulated);
        },
        controller.signal,
        model
      );

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: accumulated,
        sequence_num: messages.length + 2,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingContent('');
    } catch (err) {
      const isCancelled = err instanceof Error && err.name === 'AbortError';
      if (isCancelled) {
        // conversation is now cancelled — refresh its state
        const refreshed = await getConversation(conversationId).catch(() => null);
        if (refreshed) {
          setConv(refreshed);
          setMessages(refreshed.messages);
        }
        onStatusChange();
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
      setStreamingContent('');
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  async function handleCancel() {
    if (streaming) {
      abortRef.current?.abort();
      return;
    }
    try {
      await cancelConversation(conversationId);
      const refreshed = await getConversation(conversationId);
      setConv(refreshed);
      setMessages(refreshed.messages);
      onStatusChange();
    } catch {
      setError('Failed to cancel conversation');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!conv) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        {error ?? 'Loading…'}
      </div>
    );
  }

  const isActive = conv.status === 'active';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{conv.title ?? 'Untitled'}</h2>
          <span className="text-xs text-gray-400 capitalize">{conv.status}</span>
        </div>
        {isActive && (
          <button
            onClick={handleCancel}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            {streaming ? 'Stop' : 'Cancel'}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {streaming && streamingContent && (
          <StreamingBubble content={streamingContent} />
        )}
        {error && (
          <p className="text-xs text-red-500 text-center my-2">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {isActive ? (
        <div className="border-t border-gray-200 p-3 bg-white">
          <div className="mb-2">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={streaming}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} ({m.provider})
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              placeholder="Type a message… (Enter to send)"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 max-h-32 overflow-y-auto"
            />
            <button
              onClick={handleSend}
              disabled={streaming || !input.trim()}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 text-center text-xs text-gray-400">
          This conversation is {conv.status} — read only
        </div>
      )}
    </div>
  );
}
