import React, { useState, useEffect } from 'react';
import { Copy, Link, ExternalLink, Download, History, Trash2, Check, Scissors, Settings } from 'lucide-react';

interface UTMParams {
  url: string;
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
}

interface GeneratedLink {
  id: string;
  originalUrl: string;
  shortUrl: string;
  utmUrl: string;
  params: UTMParams;
  createdAt: Date;
  clicks: number;
  hasShortLink: boolean;
  rebrandlyId?: string;
}

interface RebrandlyConfig {
  apiKey: string;
  domain?: string;
}

const UTMGenerator: React.FC = () => {
  const [params, setParams] = useState<UTMParams>({
    url: '',
    source: '',
    medium: '',
    campaign: '',
    term: '',
    content: ''
  });
  
  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [shortUrl, setShortUrl] = useState<string>('');
  const [hasShortLink, setHasShortLink] = useState<boolean>(false);
  const [copiedState, setCopiedState] = useState<string>('');
  const [linkHistory, setLinkHistory] = useState<GeneratedLink[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [errors, setErrors] = useState<Partial<UTMParams>>({});
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [rebrandlyConfig, setRebrandlyConfig] = useState<RebrandlyConfig>({ 
    apiKey: '', 
    domain: '' 
  });
  const [isCreatingShortLink, setIsCreatingShortLink] = useState<boolean>(false);
  const [shortLinkError, setShortLinkError] = useState<string>('');

  const presets = [
    { name: 'Email Newsletter', source: 'newsletter', medium: 'email' },
    { name: 'Facebook Ad', source: 'facebook', medium: 'cpc' },
    { name: 'Google Ad', source: 'google', medium: 'cpc' },
    { name: 'Twitter Post', source: 'twitter', medium: 'social' },
    { name: 'LinkedIn Post', source: 'linkedin', medium: 'social' },
    { name: 'Blog Post', source: 'blog', medium: 'referral' }
  ];

  const validateForm = (): boolean => {
    const newErrors: Partial<UTMParams> = {};
    
    if (!params.url) newErrors.url = 'URL is required';
    else if (!isValidUrl(params.url)) newErrors.url = 'Please enter a valid URL';
    
    if (!params.source) newErrors.source = 'Campaign source is required';
    if (!params.medium) newErrors.medium = 'Campaign medium is required';
    if (!params.campaign) newErrors.campaign = 'Campaign name is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string: string): boolean => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const generateUTMUrl = (): string => {
    if (!validateForm()) return '';
    
    const url = new URL(params.url);
    url.searchParams.set('utm_source', params.source);
    url.searchParams.set('utm_medium', params.medium);
    url.searchParams.set('utm_campaign', params.campaign);
    
    if (params.term) url.searchParams.set('utm_term', params.term);
    if (params.content) url.searchParams.set('utm_content', params.content);
    
    return url.toString();
  };

  const createRebrandlyShortLink = async (longUrl: string): Promise<{ shortUrl: string; id: string } | null> => {
    if (!rebrandlyConfig.apiKey) {
      throw new Error('Rebrandly API key is required. Please configure it in settings.');
    }

    try {
      const requestBody: any = {
        destination: longUrl,
        title: `UTM Link - ${params.campaign || 'Campaign'}`
      };

      // Only add domain if it's provided and not empty
      if (rebrandlyConfig.domain && rebrandlyConfig.domain.trim()) {
        // Remove protocol if present and use just the domain name
        const cleanDomain = rebrandlyConfig.domain.replace(/^https?:\/\//, '').trim();
        requestBody.domain = { fullName: cleanDomain };
      }

      console.log('Rebrandly request:', requestBody);

      const response = await fetch('https://api.rebrandly.com/v1/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': rebrandlyConfig.apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Rebrandly error response:', errorData);
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Rebrandly success response:', data);
      
      return {
        shortUrl: data.shortUrl || `https://${data.domainName}/${data.slashtag}`,
        id: data.id
      };
    } catch (error) {
      console.error('Rebrandly API error:', error);
      throw error;
    }
  };

  const handleGenerate = (): void => {
    const utmUrl = generateUTMUrl();
    if (!utmUrl) return;
    
    setGeneratedUrl(utmUrl);
    setShortUrl('');
    setHasShortLink(false);
    setShortLinkError('');
    
    const newLink: GeneratedLink = {
      id: Date.now().toString(),
      originalUrl: params.url,
      shortUrl: '',
      utmUrl: utmUrl,
      params: { ...params },
      createdAt: new Date(),
      clicks: 0,
      hasShortLink: false
    };
    
    setLinkHistory(prev => [newLink, ...prev.slice(0, 9)]);
  };

  const handleCreateShortLink = async (): Promise<void> => {
    if (!generatedUrl) return;
    
    setIsCreatingShortLink(true);
    setShortLinkError('');
    
    try {
      const result = await createRebrandlyShortLink(generatedUrl);
      if (result) {
        setShortUrl(result.shortUrl);
        setHasShortLink(true);
        
        // Update the most recent link in history
        setLinkHistory(prev => {
          const updated = [...prev];
          if (updated.length > 0) {
            updated[0] = {
              ...updated[0],
              shortUrl: result.shortUrl,
              hasShortLink: true,
              rebrandlyId: result.id
            };
          }
          return updated;
        });
      }
    } catch (error) {
      setShortLinkError(error instanceof Error ? error.message : 'Failed to create short link');
    } finally {
      setIsCreatingShortLink(false);
    }
  };

  const createShortLinkForHistory = async (linkId: string): Promise<void> => {
    const link = linkHistory.find(l => l.id === linkId);
    if (!link) return;
    
    try {
      const result = await createRebrandlyShortLink(link.utmUrl);
      if (result) {
        setLinkHistory(prev => prev.map(l => 
          l.id === linkId 
            ? { ...l, shortUrl: result.shortUrl, hasShortLink: true, rebrandlyId: result.id }
            : l
        ));
      }
    } catch (error) {
      console.error('Failed to create short link for history item:', error);
    }
  };

  const copyToClipboard = async (text: string, type: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedState(type);
      setTimeout(() => setCopiedState(''), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const applyPreset = (preset: { source: string; medium: string }): void => {
    setParams(prev => ({
      ...prev,
      source: preset.source,
      medium: preset.medium
    }));
  };

  const clearForm = (): void => {
    setParams({
      url: '',
      source: '',
      medium: '',
      campaign: '',
      term: '',
      content: ''
    });
    setGeneratedUrl('');
    setShortUrl('');
    setHasShortLink(false);
    setErrors({});
    setShortLinkError('');
  };

  const exportHistory = (): void => {
    const csv = [
      ['Campaign Name', 'Source', 'Medium', 'Original URL', 'UTM URL', 'Short URL', 'Created', 'Clicks'],
      ...linkHistory.map(link => [
        link.params.campaign,
        link.params.source,
        link.params.medium,
        link.originalUrl,
        link.utmUrl,
        link.shortUrl || 'Not created',
        link.createdAt.toLocaleDateString(),
        link.clicks.toString()
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'utm-links.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const deleteFromHistory = (id: string): void => {
    setLinkHistory(prev => prev.filter(link => link.id !== id));
  };

  const saveRebrandlyConfig = (): void => {
    localStorage.setItem('rebrandly-config', JSON.stringify(rebrandlyConfig));
    setShowSettings(false);
  };

  const testApiConnection = async (): Promise<void> => {
    if (!rebrandlyConfig.apiKey) {
      setShortLinkError('API key is required');
      return;
    }

    setIsCreatingShortLink(true);
    setShortLinkError('');

    try {
      const response = await fetch('https://api.rebrandly.com/v1/account', {
        headers: {
          'apikey': rebrandlyConfig.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`API test failed: ${response.status}`);
      }

      const data = await response.json();
      setShortLinkError(`✅ API connection successful! Account: ${data.email}`);
    } catch (error) {
      setShortLinkError(`❌ API test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreatingShortLink(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('utm-history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved).map((item: any) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          hasShortLink: item.hasShortLink || false,
          rebrandlyId: item.rebrandlyId || undefined
        }));
        setLinkHistory(parsed);
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }

    const savedConfig = localStorage.getItem('rebrandly-config');
    if (savedConfig) {
      try {
        setRebrandlyConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error('Failed to load Rebrandly config:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('utm-history', JSON.stringify(linkHistory));
  }, [linkHistory]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
              UTM Link Generator
            </h1>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
              title="Settings"
            >
              <Settings size={24} />
            </button>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Create trackable campaign URLs with UTM parameters. Generate, shorten with Rebrandly, and manage your marketing links effortlessly.
          </p>
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
              <h2 className="text-2xl font-semibold text-gray-900 mb-6">Rebrandly Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key *
                  </label>
                  <input
                    type="password"
                    value={rebrandlyConfig.apiKey}
                    onChange={(e) => setRebrandlyConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder="Enter your Rebrandly API key"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Get your API key from <a href="https://app.rebrandly.com/account/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Rebrandly Dashboard</a>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Domain (Optional)
                  </label>
                  <input
                    type="text"
                    value={rebrandlyConfig.domain || ''}
                    onChange={(e) => setRebrandlyConfig(prev => ({ ...prev, domain: e.target.value }))}
                    placeholder="utm.jaskey.in"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter just the domain name (e.g., utm.jaskey.in). Leave empty to use rebrand.ly
                  </p>
                </div>

                <button
                  onClick={testApiConnection}
                  disabled={isCreatingShortLink || !rebrandlyConfig.apiKey}
                  className="w-full px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreatingShortLink ? 'Testing...' : 'Test API Connection'}
                </button>

                {shortLinkError && (
                  <div className="p-3 rounded-lg bg-gray-50 text-sm">
                    {shortLinkError}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={saveRebrandlyConfig}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  Save Settings
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Campaign Details</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website URL *
                  </label>
                  <input
                    type="url"
                    value={params.url}
                    onChange={(e) => setParams(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://example.com"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.url ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.url && <p className="text-red-500 text-sm mt-1">{errors.url}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Campaign Source *
                    </label>
                    <input
                      type="text"
                      value={params.source}
                      onChange={(e) => setParams(prev => ({ ...prev, source: e.target.value }))}
                      placeholder="google, newsletter, facebook"
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                        errors.source ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.source && <p className="text-red-500 text-sm mt-1">{errors.source}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Campaign Medium *
                    </label>
                    <input
                      type="text"
                      value={params.medium}
                      onChange={(e) => setParams(prev => ({ ...prev, medium: e.target.value }))}
                      placeholder="cpc, email, social"
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                        errors.medium ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.medium && <p className="text-red-500 text-sm mt-1">{errors.medium}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    value={params.campaign}
                    onChange={(e) => setParams(prev => ({ ...prev, campaign: e.target.value }))}
                    placeholder="spring_sale, product_launch"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.campaign ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.campaign && <p className="text-red-500 text-sm mt-1">{errors.campaign}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Campaign Term (Optional)
                    </label>
                    <input
                      type="text"
                      value={params.term}
                      onChange={(e) => setParams(prev => ({ ...prev, term: e.target.value }))}
                      placeholder="keyword, search term"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Campaign Content (Optional)
                    </label>
                    <input
                      type="text"
                      value={params.content}
                      onChange={(e) => setParams(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="banner, sidebar"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Quick Presets</h3>
                <div className="grid grid-cols-2 gap-3">
                  {presets.map((preset, index) => (
                    <button
                      key={index}
                      onClick={() => applyPreset(preset)}
                      className="p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="font-medium text-sm text-gray-900">{preset.name}</div>
                      <div className="text-xs text-gray-500">{preset.source} / {preset.medium}</div>
                    </button>
                  ))}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleGenerate}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                  >
                    <Link size={20} />
                    Generate UTM Link
                  </button>
                  <button
                    onClick={clearForm}
                    className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>

          {generatedUrl && (
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Generated Links</h3>
              
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">UTM Link</label>
                    <button
                      onClick={() => copyToClipboard(generatedUrl, 'utm')}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      {copiedState === 'utm' ? <Check size={16} /> : <Copy size={16} />}
                      {copiedState === 'utm' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-white p-3 rounded border break-all text-sm font-mono">
                    {generatedUrl}
                  </div>
                </div>

                {!hasShortLink && (
                  <div className="flex flex-col items-center gap-3">
                    <button
                      onClick={handleCreateShortLink}
                      disabled={isCreatingShortLink || !rebrandlyConfig.apiKey}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <Scissors size={18} />
                      {isCreatingShortLink ? 'Creating...' : 'Create Short Link'}
                    </button>
                    {!rebrandlyConfig.apiKey && (
                      <p className="text-sm text-amber-600">
                        Configure Rebrandly API key in settings to create short links
                      </p>
                    )}
                    {shortLinkError && (
                      <p className="text-sm text-red-600 text-center">
                        {shortLinkError}
                      </p>
                    )}
                  </div>
                )}

                {hasShortLink && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Short Link</label>
                      <button
                        onClick={() => copyToClipboard(shortUrl, 'short')}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        {copiedState === 'short' ? <Check size={16} /> : <Copy size={16} />}
                        {copiedState === 'short' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div className="bg-white p-3 rounded border break-all text-sm font-mono">
                      {shortUrl}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <a
                    href={generatedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <ExternalLink size={16} />
                    Test Link
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Link History</h3>
              <div className="flex gap-2">
                <button
                  onClick={exportHistory}
                  disabled={linkHistory.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Download size={16} />
                  Export CSV
                </button>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <History size={16} />
                  {showHistory ? 'Hide' : 'Show'} History
                </button>
              </div>
            </div>

            {showHistory && linkHistory.length > 0 && (
              <div className="space-y-4">
                {linkHistory.map((link) => (
                  <div key={link.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-gray-900">{link.params.campaign}</h4>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {link.params.source} / {link.params.medium}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2 break-all">
                          <strong>UTM:</strong> {link.utmUrl}
                        </div>
                        {link.hasShortLink && (
                          <div className="text-sm text-gray-600 mb-2 break-all">
                            <strong>Short:</strong> {link.shortUrl}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          Created: {link.createdAt.toLocaleDateString()} • Clicks: {link.clicks}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {!link.hasShortLink && rebrandlyConfig.apiKey && (
                          <button
                            onClick={() => createShortLinkForHistory(link.id)}
                            className="p-2 text-purple-600 hover:text-purple-700 transition-colors"
                            title="Create short link"
                          >
                            <Scissors size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => copyToClipboard(link.hasShortLink ? link.shortUrl : link.utmUrl, `history-${link.id}`)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          {copiedState === `history-${link.id}` ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                        <button
                          onClick={() => deleteFromHistory(link.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showHistory && linkHistory.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <History size={48} className="mx-auto mb-4 opacity-50" />
                <p>No links generated yet. Create your first UTM link above!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UTMGenerator;