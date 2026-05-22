export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sequence_num: number;
  provider?: string;
  model?: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  status: 'active' | 'cancelled' | 'completed';
  message_count: number;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}
