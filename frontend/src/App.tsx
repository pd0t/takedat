import { useState } from 'react';
import { Send, Download } from 'lucide-react';
import { clsx } from 'clsx';
import { SenderView } from './components/sender/SenderView';
import { ReceiverView } from './components/receiver/ReceiverView';

type Tab = 'send' | 'receive';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('send');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-800 text-center">
            TakeDat
          </h1>
          <p className="text-gray-500 text-center text-sm mt-1">
            Simple, secure file transfers
          </p>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-md mx-auto mt-6 px-4">
        <div className="flex bg-white rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('send')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-md font-medium transition-colors',
              activeTab === 'send'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Send className="w-5 h-5" />
            Send
          </button>
          <button
            onClick={() => setActiveTab('receive')}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-md font-medium transition-colors',
              activeTab === 'receive'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <Download className="w-5 h-5" />
            Receive
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto mt-6 px-4 pb-8">
        <div className="bg-white rounded-xl shadow-lg">
          {activeTab === 'send' ? <SenderView /> : <ReceiverView />}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-gray-400 text-sm">
        Files are transferred directly between devices
      </footer>
    </div>
  );
}

export default App;
