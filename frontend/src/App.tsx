import { useEffect, useState } from 'react';
import { Conversation } from './types';
import { listConversations } from './api/client';
import { ConversationList } from './components/ConversationList';
import { ConversationView } from './components/ConversationView';
import { Dashboard } from './components/Dashboard';

type View = { type: 'chat'; conversationId: string } | { type: 'dashboard' } | { type: 'empty' };

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [view, setView] = useState<View>({ type: 'empty' });

  async function loadList() {
    try {
      const data = await listConversations();
      setConversations(data);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  function handleCreated(conv: Conversation) {
    setConversations((prev) => [conv, ...prev]);
    setView({ type: 'chat', conversationId: conv.id });
  }

  function handleSelect(id: string) {
    setView({ type: 'chat', conversationId: id });
  }

  const selectedId = view.type === 'chat' ? view.conversationId : null;

  return (
    <div className="flex h-screen bg-white text-gray-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-base font-semibold text-gray-900">Ollive Chat</h1>
          <button
            onClick={() => setView({ type: 'dashboard' })}
            className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
              view.type === 'dashboard'
                ? 'bg-gray-900 text-white'
                : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
            title="Dashboard"
          >
            Dashboard
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={handleSelect}
            onCreated={handleCreated}
          />
        </div>
      </aside>

      {/* Main panel */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {view.type === 'dashboard' ? (
          <Dashboard />
        ) : view.type === 'chat' ? (
          <ConversationView
            key={view.conversationId}
            conversationId={view.conversationId}
            onStatusChange={loadList}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
            <p className="text-base">Select a conversation or start a new one</p>
            <p className="text-sm">Click "+ New Chat" in the sidebar</p>
          </div>
        )}
      </main>
    </div>
  );
}
