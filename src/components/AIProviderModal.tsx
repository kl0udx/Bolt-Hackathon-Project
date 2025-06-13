import React, { useState, useEffect } from 'react';
import { X, Bot, Key, ExternalLink, CheckCircle } from 'lucide-react';

interface AIProvider {
  id: string;
  name: string;
  description: string;
  website: string;
  hasKey: boolean;
}

interface AIProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId?: string;
  userId?: string;
}

export function AIProviderModal({ isOpen, onClose, roomId, userId }: AIProviderModalProps) {
  const [providers, setProviders] = useState<AIProvider[]>([
    {
      id: 'openai',
      name: 'ChatGPT',
      description: 'OpenAI\'s GPT model for natural language conversations',
      website: 'https://platform.openai.com/api-keys',
      hasKey: false
    },
    {
      id: 'anthropic',
      name: 'Claude',
      description: 'Anthropic\'s Claude model for detailed and thoughtful responses',
      website: 'https://console.anthropic.com/settings/keys',
      hasKey: false
    },
    {
      id: 'google',
      name: 'Google AI',
      description: 'Google\'s Gemini model for versatile AI interactions',
      website: 'https://makersuite.google.com/app/apikey',
      hasKey: false
    }
  ]);

  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load existing API keys from localStorage
  useEffect(() => {
    const loadKeys = () => {
      const updatedProviders = providers.map(provider => ({
        ...provider,
        hasKey: !!localStorage.getItem(`ai_key_${provider.id}`)
      }));
      setProviders(updatedProviders);
    };

    if (isOpen) {
      loadKeys();
    }
  }, [isOpen]);

  const handleProviderSelect = (provider: AIProvider) => {
    setSelectedProvider(provider);
    // Load existing key if available
    const existingKey = localStorage.getItem(`ai_key_${provider.id}`);
    if (existingKey) {
      setApiKey(existingKey);
    } else {
      setApiKey('');
    }
  };

  const handleSaveKey = async () => {
    if (!selectedProvider || !apiKey.trim()) return;

    setIsSaving(true);
    try {
      // Store the key in localStorage
      localStorage.setItem(`ai_key_${selectedProvider.id}`, apiKey.trim());
      
      // Update provider state
      setProviders(prev => prev.map(p => 
        p.id === selectedProvider.id ? { ...p, hasKey: true } : p
      ));

      // Close the modal after successful save
      onClose();
    } catch (error) {
      console.error('Failed to save API key:', error);
      // TODO: Show error toast
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-gray-900">AI Chat Provider</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {!selectedProvider ? (
            // Provider Selection
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                Select an AI provider to use for chat. You'll need to provide an API key for the selected provider.
              </p>
              {providers.map(provider => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderSelect(provider)}
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        {provider.name}
                        {provider.hasKey && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {provider.description}
                      </div>
                    </div>
                    <Key className={`w-5 h-5 ${
                      provider.hasKey ? 'text-green-500' : 'text-gray-400 group-hover:text-blue-500'
                    }`} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            // API Key Input
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">{selectedProvider.name} API Key</h4>
                <a
                  href={selectedProvider.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
                >
                  Get API Key
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              
              <div className="space-y-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500">
                  Your API key is stored locally in your browser and is never sent to our servers.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSelectedProvider(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveKey}
                  disabled={!apiKey.trim() || isSaving}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Key'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 