import { Conversation } from '../types';
import { createConversation } from '../api/client';

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: (conv: Conversation) => void;
}

function statusBadge(status: Conversation['status']) {
  const base = 'text-xs px-1.5 py-0.5 rounded-full font-medium';
  if (status === 'active') return `${base} bg-green-100 text-green-700`;
  if (status === 'cancelled') return `${base} bg-red-100 text-red-600`;
  return `${base} bg-gray-100 text-gray-500`;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ConversationList({ conversations, selectedId, onSelect, onCreated }: Props) {
  async function handleNew() {
    try {
      const conv = await createConversation();
      onCreated(conv);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={handleNew}
          className="w-full py-2 px-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-8 px-4">No conversations yet</p>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
              selectedId === conv.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-gray-800 truncate flex-1">
                {conv.title ?? 'Untitled'}
              </span>
              <span className={statusBadge(conv.status)}>{conv.status}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-400">{conv.message_count} msgs</span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{relativeTime(conv.updated_at)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
