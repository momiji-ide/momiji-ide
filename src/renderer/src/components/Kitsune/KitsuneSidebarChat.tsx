import { useKitsuneChat } from './useKitsuneChat'
import { KitsuneChatView } from './KitsuneChatView'
import { ContextBar } from './chatRender'
import kitsuneNormal  from '../../assets/kitsune-normal.png'
import kitsuneHappy   from '../../assets/kitsune-happy.png'
import kitsuneConfuse from '../../assets/kitsune-confuse.png'

// Compact docked chat for the secondary right sidebar — same chat hook/UI as
// the merged Kitsune panel, without the pixel office or mission control.
export function KitsuneSidebarChat() {
  const chat = useKitsuneChat()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <style>{`@keyframes kitsuneIdleFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }`}</style>
      <div className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{ height: 38, background: 'var(--bg-mantle)', borderBottom: '1px solid var(--border)' }}>
        <img
          src={chat.kitsuneExpr === 'thinking' ? kitsuneConfuse : chat.kitsuneExpr === 'happy' ? kitsuneHappy : kitsuneNormal}
          style={{ width: 22, height: 22, objectFit: 'contain', transition: 'all 0.3s ease', flexShrink: 0 }}
          alt="Kitsune"
        />
        <span className="text-xs font-black tracking-widest" style={{ color: 'var(--accent-mauve)' }}>KITSUNE AI</span>
        {chat.isLoading && <span className="text-xs px-1.5 py-0.5 rounded-full animate-pulse" style={{ background: 'var(--accent-green)22', color: 'var(--accent-green)', border: '1px solid var(--accent-green)44', fontSize: 9 }}>● live</span>}
        <div className="flex-1" />
        {chat.messages.length > 0 && !chat.isLoading && (
          <button onClick={chat.clearChat} className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Clear</button>
        )}
      </div>
      <KitsuneChatView chat={chat} />
      {chat.activeProvider && chat.contextUsed > 0 && (
        <ContextBar used={chat.contextUsed} model={chat.activeProvider.model} />
      )}
    </div>
  )
}
