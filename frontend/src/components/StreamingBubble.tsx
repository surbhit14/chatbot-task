interface Props {
  content: string;
}

export function StreamingBubble({ content }: Props) {
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[75%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed bg-gray-100 text-gray-900 whitespace-pre-wrap break-words">
        {content}
        <span className="inline-block w-0.5 h-4 bg-gray-500 ml-0.5 align-middle animate-pulse" />
      </div>
    </div>
  );
}
