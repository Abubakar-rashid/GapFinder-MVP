"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

import {
  Search,
  Bell,
  Settings,
  User,
  ChevronDown,
  LogOut,
  TrendingUp,
  Building2,
  Activity,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Star,
  MessageSquare,
  BarChart3,
  ChevronUp,
  TrendingDown,
  Users,
  PieChart,
  Target,
  Flag,
  Quote,
  Filter,
  Download,
  AlertTriangle,
  Share2
} from 'lucide-react';
import { getCurrentUser, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';

// --- INTERFACES ---
interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface Brand {
  id: string;
  name: string;
  created_at: string;
}

interface Analysis {
  id: string;
  brand_id: string;
  workspace_id: string;
  status: string;
  result_data: any;
  created_at: string;
  updated_at: string;
}

interface HarvestJob {
  id: string;
  brand_id: string;
  trigger_type: string;
  status: string;
  created_at: string;
}

interface AnalysisWithBrand {
  id: string;
  brand_id: string;
  workspace_id: string;
  status: string;
  result_data: any;
  created_at: string;
  updated_at: string;
  brands: {
    id: string;
    name: string;
  };
}

interface AnalysisDetailProps {
  analysis: AnalysisWithBrand;
  onBack: () => void;
  rerunAnalysis: (analysis: AnalysisWithBrand) => void;
}

interface PainPoint {
  title: string;
  description: string;
  examples: string[];
}

interface AnalysisData {
  pain_points?: string[];
  url?: string;
  summary?: {
    total_reviews_analyzed?: number;
    sentiment_breakdown?: {
      positive: number;
      neutral: number;
      negative: number;
    };
    key_themes?: string[];
    competitor_analysis?: string[];
    risk_score?: number;
  };
}

interface TabButtonProps {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

interface AnalysisResultsProps {
  analysisData: AnalysisData;
}

// --- HELPER FUNCTION ---
const normalizeBrandName = (name: string): string => {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
};

// --- PAIN POINT PARSING FUNCTION ---
const parsePainPoints = (painPointsArray: string[] | undefined): PainPoint[] => {
  if (!Array.isArray(painPointsArray)) return [];
  
  const parsed: PainPoint[] = [];
  let currentPainPoint: PainPoint | null = null;
  
  painPointsArray.forEach((item: string) => {
    if (!item || !item.trim()) return;
    
    if (/^\d+\./.test(item)) {
      if (currentPainPoint) {
        parsed.push(currentPainPoint);
      }
      currentPainPoint = {
        title: item,
        description: '',
        examples: []
      };
    } else if (item.startsWith('Review example')) {
      if (currentPainPoint) {
        currentPainPoint.examples.push(item);
      }
    } else if (currentPainPoint && !currentPainPoint.description) {
      currentPainPoint.description = item;
    }
  });
  
  if (currentPainPoint) {
    parsed.push(currentPainPoint);
  }
  
  return parsed;
};

// --- BEAUTIFUL ANALYSIS RESULTS COMPONENT ---
const AnalysisResultsBeautified: React.FC<AnalysisResultsProps> = ({ analysisData }) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [expandedPainPoint, setExpandedPainPoint] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const painPoints = parsePainPoints(analysisData.pain_points);
  
  const getSeverityColor = (index: number): string => {
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-purple-500'];
    return colors[index % colors.length];
  };

  const getSeverityLevel = (index: number): string => {
    const levels = ['Critical', 'High', 'Medium', 'Medium', 'Low'];
    return levels[index % levels.length];
  };

  const filteredPainPoints = painPoints.filter((point: PainPoint) =>
    point.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    point.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const TabButton: React.FC<TabButtonProps> = ({ id, label, icon: Icon, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
        isActive 
          ? 'bg-teal-600 text-white shadow-lg' 
          : 'bg-white/60 text-gray-600 hover:bg-white/80 hover:text-gray-900'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );

  const StatCard: React.FC<StatCardProps> = ({ icon: Icon, title, value, subtitle, color = "bg-blue-500" }) => (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={MessageSquare}
          title="Reviews Analyzed"
          value={analysisData.summary?.total_reviews_analyzed?.toLocaleString() || "N/A"}
          color="bg-teal-500"
        />
        <StatCard
          icon={AlertTriangle}
          title="Risk Score"
          value={analysisData.summary?.risk_score?.toString() || "N/A"}
          subtitle="Out of 10"
          color="bg-red-500"
        />
        <StatCard
          icon={Target}
          title="Pain Points"
          value={painPoints.length}
          subtitle="Critical issues found"
          color="bg-orange-500"
        />
        <StatCard
          icon={TrendingDown}
          title="Negative Sentiment"
          value={`${analysisData.summary?.sentiment_breakdown?.negative || 0}%`}
          color="bg-purple-500"
        />
      </div>

      {analysisData.summary?.sentiment_breakdown && (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <PieChart className="w-5 h-5 mr-2 text-teal-600" />
            Sentiment Analysis
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-2 flex items-center justify-center">
                <span className="text-2xl font-bold text-green-600">
                  {analysisData.summary.sentiment_breakdown.positive}%
                </span>
              </div>
              <p className="text-sm font-medium text-gray-600">Positive</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full mx-auto mb-2 flex items-center justify-center">
                <span className="text-2xl font-bold text-yellow-600">
                  {analysisData.summary.sentiment_breakdown.neutral}%
                </span>
              </div>
              <p className="text-sm font-medium text-gray-600">Neutral</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-2 flex items-center justify-center">
                <span className="text-2xl font-bold text-red-600">
                  {analysisData.summary.sentiment_breakdown.negative}%
                </span>
              </div>
              <p className="text-sm font-medium text-gray-600">Negative</p>
            </div>
          </div>
        </div>
      )}

      {analysisData.summary?.key_themes && (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Flag className="w-5 h-5 mr-2 text-teal-600" />
            Key Themes Identified
          </h3>
          <div className="flex flex-wrap gap-2">
            {analysisData.summary.key_themes.map((theme: string, index: number) => (
              <span
                key={index}
                className="px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm font-medium"
              >
                #{theme}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderPainPoints = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search pain points..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredPainPoints.map((painPoint: PainPoint, index: number) => (
          <div key={index} className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 overflow-hidden">
            <div 
              className="p-6 cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={() => setExpandedPainPoint(expandedPainPoint === index ? null : index)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className={`w-3 h-3 rounded-full ${getSeverityColor(index)}`}></div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      index === 0 ? 'bg-red-100 text-red-800' :
                      index === 1 ? 'bg-orange-100 text-orange-800' :
                      index === 2 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {getSeverityLevel(index)} Priority
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {painPoint.title}
                  </h3>
                  <p className="text-gray-600 text-sm line-clamp-3">
                    {painPoint.description}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  {expandedPainPoint === index ? 
                    <ChevronUp className="w-5 h-5 text-gray-400" /> : 
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  }
                </div>
              </div>
            </div>
            
            {expandedPainPoint === index && (
              <div className="px-6 pb-6 border-t border-gray-100 bg-gray-50/30">
                <div className="pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    <Quote className="w-4 h-4 mr-2 text-gray-600" />
                    Customer Examples
                  </h4>
                  <div className="space-y-3">
                    {painPoint.examples.map((example: string, exampleIndex: number) => (
                      <div key={exampleIndex} className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Users className="w-4 h-4 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-700 italic">
                              "{example.replace(/^Review example \d+: /, '')}"
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderCompetitors = () => (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-teal-600" />
          Competitor Analysis
        </h3>
        {analysisData.summary?.competitor_analysis ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analysisData.summary.competitor_analysis.map((competitor: string, index: number) => (
              <div key={index} className="bg-gradient-to-br from-gray-50 to-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{competitor}</h4>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-sm text-gray-600">Alternative solution</p>
                <div className="mt-3 flex items-center space-x-2">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < 4 ? 'fill-current' : ''}`} />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">4.0/5</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No competitor analysis available.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analysis Results</h2>
          <p className="text-gray-600">Company: {analysisData.url || 'Unknown'}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center space-x-2 px-4 py-2 bg-white/60 border border-gray-300 rounded-lg hover:bg-white/80 transition-colors">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 bg-white/40 backdrop-blur-sm p-2 rounded-xl border border-gray-200">
        <TabButton
          id="overview"
          label="Overview"
          icon={BarChart3}
          isActive={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
        />
        <TabButton
          id="painpoints"
          label="Pain Points"
          icon={AlertTriangle}
          isActive={activeTab === 'painpoints'}
          onClick={() => setActiveTab('painpoints')}
        />
        <TabButton
          id="competitors"
          label="Competitors"
          icon={Target}
          isActive={activeTab === 'competitors'}
          onClick={() => setActiveTab('competitors')}
        />
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'painpoints' && renderPainPoints()}
        {activeTab === 'competitors' && renderCompetitors()}
      </div>
    </div>
  );
};

// --- UPDATED ANALYSIS DETAIL COMPONENT ---
const AnalysisDetail: React.FC<AnalysisDetailProps> = ({ analysis, onBack, rerunAnalysis }) => {
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'running': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'running': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white" style={{ backgroundImage: 'url(/background.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Button onClick={onBack} variant="ghost" size="sm" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Button>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-gray-900">Analysis Details</span>
          </div>
        </div>
      </header>
      
      <main className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200 p-8 mb-8">
            <div className="flex flex-col sm:flex-row items-start justify-between mb-6 gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{analysis.brands?.name || 'Unknown Brand'}</h1>
                <p className="text-lg text-gray-600">Company Analysis Report</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(analysis.status)}`}>
                  {getStatusIcon(analysis.status)}
                  <span className="ml-2 capitalize">{analysis.status}</span>
                </div>
                {analysis.status === "completed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rerunAnalysis(analysis)}
                  >
                    Re-run Analysis
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/60 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Created</span>
                </div>
                <p className="text-sm text-gray-900">{formatDate(analysis.created_at)}</p>
              </div>
              <div className="bg-white/60 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Last Updated</span>
                </div>
                <p className="text-sm text-gray-900">{analysis.updated_at ? formatDate(analysis.updated_at) : 'N/A'}</p>
              </div>
              <div className="bg-white/60 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Analysis ID</span>
                </div>
                <p className="text-sm text-gray-900 font-mono">{analysis.id.slice(0, 8)}...</p>
              </div>
            </div>
          </div>
          {analysis.status === 'completed' && analysis.result_data ? (
            <AnalysisResultsBeautified analysisData={analysis.result_data} />
          ) : (
            <div className="bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {getStatusIcon(analysis.status)}
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Analysis {analysis.status}</h3>
              <p className="text-gray-600">
                {analysis.status === 'running' ? 'Results will appear here once the analysis is complete.' : 
                 analysis.status === 'failed' ? 'This analysis failed. Please try running it again.' :
                 'Results are not yet available. Please check back later.'}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// --- ALL ANALYSES VIEW ---
const AllAnalysesView: React.FC<{
  analyses: AnalysisWithBrand[];
  loading: boolean;
  onBack: () => void;
  onSelect: (analysis: AnalysisWithBrand) => void;
}> = ({ analyses, loading, onBack, onSelect }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white" style={{ backgroundImage: 'url(/background.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Button>
          <h1 className="text-xl font-semibold text-gray-900">All Analyses</h1>
        </div>
      </header>

      <main className="p-6">
        <div className="max-w-6xl mx-auto space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600" />
            </div>
          ) : analyses.length === 0 ? (
            <div className="text-center text-gray-500 py-12 bg-white/60 rounded-lg border">
              No analyses found in this workspace.
            </div>
          ) : (
            analyses.map((analysis) => (
              <div
                key={analysis.id}
                className="bg-white/60 rounded-lg border p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                onClick={() => onSelect(analysis)}
              >
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {analysis.brands?.name || "Unknown Brand"}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Status:{" "}
                    <span className="capitalize font-medium">
                      {analysis.status}
                    </span>
                  </p>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(analysis.created_at).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
};


// --- MAIN DASHBOARD COMPONENT (rest of your existing code stays the same) ---
export default function ModernDashboard() {
  // ... (all your existing dashboard code stays exactly the same)
  const [showAllAnalyses, setShowAllAnalyses] = useState(false);
  const [allAnalyses, setAllAnalyses] = useState<AnalysisWithBrand[]>([]);
  const [allAnalysesLoading, setAllAnalysesLoading] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [signingOut, setSigningOut] = useState<boolean>(false);
  const [userAnalyses, setUserAnalyses] = useState<AnalysisWithBrand[]>([]);
  const [analysesLoading, setAnalysesLoading] = useState<boolean>(false);
  const [userWorkspaceId, setUserWorkspaceId] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisWithBrand | null>(null);
  const [stats, setStats] = useState({ totalAnalyses: 0, pendingJobs: 0, completedToday: 0, successRate: 0 });

  useEffect(() => {
    checkAuth();
    loadRecentSearches();
  }, []);

  useEffect(() => {
    if (userWorkspaceId) {
      fetchDashboardStats();
    }
  }, [userWorkspaceId]);

  useEffect(() => {
    if (!userWorkspaceId) return;

    const channel = supabase
      .channel("analyses-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "analyses",
        },
        (payload) => {
          console.log("Analysis updated:", payload);

          if (payload.new.workspace_id !== userWorkspaceId) return;

          setUserAnalyses((prev) =>
            prev.map((analysis) =>
              analysis.id === payload.new.id
                ? { ...analysis, ...payload.new }
                : analysis
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userWorkspaceId]);

  const fetchAllAnalyses = async (workspaceId: string) => {
    setAllAnalysesLoading(true);
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select(`*, brands (id, name)`)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllAnalyses(data || []);
    } catch (err) {
      console.error('Error fetching all analyses:', err);
      setAllAnalyses([]);
    } finally {
      setAllAnalysesLoading(false);
    }
  };

  const rerunAnalysis = async (analysis: AnalysisWithBrand) => {
    if (!userWorkspaceId) return;

    try {
      const { data: newAnalysis, error: analysisError } = await supabase
        .from("analyses")
        .insert([
          {
            brand_id: analysis.brand_id,
            workspace_id: userWorkspaceId,
            status: "queued",
            result_data: null,
          },
        ])
        .select(`
          id,
          brand_id,
          workspace_id,
          status,
          created_at,
          updated_at,
          result_data,
          brands (id, name)
        `)
        .single<AnalysisWithBrand>();

      if (analysisError) {
        console.error("Supabase analysis insert error:", analysisError);
        throw analysisError;
      }

      const { error: jobError } = await supabase.from("harvest_jobs").insert([
        {
          brand_id: analysis.brand_id,
          workspace_id: userWorkspaceId,
          trigger_type: "manual",
          status: "queued",
          analyses_id: newAnalysis.id,
        },
      ]);

      if (jobError) {
        console.error("Supabase harvest_jobs insert error:", jobError);
        throw jobError;
      }

      setUserAnalyses((prev) => [newAnalysis, ...prev]);
      setSelectedAnalysis(newAnalysis);

    } catch (err: any) {
      console.error("Error rerunning analysis:", err.message || err);
      alert("Failed to rerun analysis. Please try again.");
    }
  };

  const checkAuth = async () => {
    try {
      const { user: currentUser } = await getCurrentUser();
      if (!currentUser) {
        window.location.href = '/auth';
        return;
      }
      setUser(currentUser as AuthUser);
      await fetchUserWorkspace(currentUser.id);
    } catch (error) {
      console.error('Auth check failed:', error);
      window.location.href = '/auth';
    } finally {
      setLoading(false);
    }
  };

  const fetchUserWorkspace = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      if (data) {
        setUserWorkspaceId(data.workspace_id);
        await fetchUserAnalyses(data.workspace_id);
      }
    } catch (error) {
      console.error('Error fetching user workspace:', error);
    }
  };

  const fetchUserAnalyses = async (workspaceId: string) => {
    setAnalysesLoading(true);
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select(`*, brands (id, name)`)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setUserAnalyses(data || []);
    } catch (error) {
      console.error('Error fetching user analyses:', error);
    } finally {
      setAnalysesLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    console.log('Fetching dashboard stats...');
  };

  const loadRecentSearches = () => {
    try {
      const saved = localStorage.getItem('gapfinder_recent_searches');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearch = (query: string) => {
    try {
      const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('gapfinder_recent_searches', JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  const handleFindGap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !userWorkspaceId) return;

    setSearchLoading(true);
    setSearchResult(null);

    const normalizedQuery = normalizeBrandName(searchQuery);

    try {
      saveRecentSearch(searchQuery.trim());

      const { data: existingBrands, error: brandError } = await supabase
        .from('brands')
        .select('*')
        .eq('workspace_id', userWorkspaceId);

      if (brandError) throw brandError;

      const exactMatch = existingBrands?.find(b => normalizeBrandName(b.name) === normalizedQuery);
      let brand = exactMatch;

      if (brand) {
        const { data: existingAnalysis } = await supabase
          .from('analyses')
          .select(`*, brands (id, name)`)
          .eq('brand_id', brand.id)
          .eq('workspace_id', userWorkspaceId)
          .maybeSingle();

        if (existingAnalysis) {
          if (existingAnalysis.status === 'queued' || existingAnalysis.status === 'running') {
            setSearchResult({
              type: 'already_queued',
              message: `An analysis for "${existingAnalysis.brands.name}" is already in progress.`
            });
            setSearchLoading(false);
            return;
          }
          setSelectedAnalysis(existingAnalysis);
          setSearchQuery('');
          setSearchLoading(false);
          return;
        }
      }

      if (!brand) {
        const { data: newBrand, error } = await supabase
          .from('brands')
          .insert([{ name: searchQuery.trim(), workspace_id: userWorkspaceId }])
          .select()
          .single();

        if (error) throw error;
        brand = newBrand;
      }

      console.log('Creating new analysis for brand:', brand.name);

      const { data: newAnalysis, error: analysisError } = await supabase
        .from('analyses')
        .insert([{
          brand_id: brand.id,
          workspace_id: userWorkspaceId,
          status: 'queued',
          result_data: null
        }])
        .select(`
          id,
          brand_id,
          workspace_id,
          status,
          created_at,
          updated_at,
          result_data,
          brands (id, name)
        `)
        .single();

      if (analysisError) {
        console.error("Error creating analysis:", analysisError);
        throw analysisError;
      }

      console.log('Created analysis with ID:', newAnalysis.id);

      const { data: newJob, error: jobError } = await supabase
        .from('harvest_jobs')
        .insert([{
          brand_id: brand.id,
          workspace_id: userWorkspaceId,
          trigger_type: 'manual',
          status: 'queued',
          analyses_id: newAnalysis.id
        }])
        .select('*')
        .single();

      if (jobError) {
        console.error("Error creating harvest job:", jobError);
        await supabase.from('analyses').delete().eq('id', newAnalysis.id);
        throw jobError;
      }

      console.log('Created harvest job:', newJob);

      setSearchResult({
        type: 'new_job_created',
        message: `Analysis queued for "${brand.name}"! It will appear below shortly.`
      });

      setSearchQuery('');
      await fetchUserAnalyses(userWorkspaceId);
      await fetchDashboardStats();

    } catch (error: any) {
      console.error('Find Gap error:', error);
      setSearchResult({
        type: 'error',
        message: `An error occurred: ${error.message || 'Unknown error'}. Please try again.`
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleLogout = async () => {
    setSigningOut(true);
    await signOut();
    localStorage.removeItem('gapfinder_recent_searches');
    window.location.href = '/auth';
  };

  const getUserDisplayName = (): string => {
    return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-teal-600" />
      </div>
    );
  }

  if (selectedAnalysis) {
    return (
      <AnalysisDetail
        analysis={selectedAnalysis}
        onBack={() => setSelectedAnalysis(null)}
        rerunAnalysis={rerunAnalysis}
      />
    );
  }

  if (showAllAnalyses) {
    return (
      <AllAnalysesView
        analyses={allAnalyses}
        loading={allAnalysesLoading}
        onBack={() => setShowAllAnalyses(false)}
        onSelect={setSelectedAnalysis}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white" style={{ backgroundImage: 'url(/background.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <header className="relative z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold text-gray-900">GapFinder</span>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAllAnalyses(true);
                if (userWorkspaceId) fetchAllAnalyses(userWorkspaceId);
              }}
              className="hidden sm:inline-flex"
            >
              View All Analyses
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} disabled={signingOut}>
              {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              <span className="ml-2 hidden sm:inline">{signingOut ? 'Signing out...' : 'Sign out'}</span>
            </Button>
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-gray-600" />
            </div>
          </div>
        </div>
      </header>
      <main className="relative z-10 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center pt-12 pb-16 px-4">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Find a company you can trust</h1>
            <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">Discover, analyze, and find gaps in company reviews and reputation</p>
            <form onSubmit={handleFindGap} className="relative max-w-2xl mx-auto mb-8">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search company or brand..."
                className="w-full px-6 py-4 text-lg border border-gray-300 rounded-full focus:ring-2 focus:ring-teal-500"
                disabled={searchLoading}
              />
              <Button
                type="submit"
                disabled={searchLoading || !searchQuery.trim()}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-teal-600 hover:bg-teal-700 text-white px-8 py-2 rounded-full font-medium"
              >
                {searchLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  'Find Gap'
                )}
              </Button>
            </form>
            {searchResult && (
              <p className={`mt-4 text-sm ${searchResult.type === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
                {searchResult.message}
              </p>
            )}
          </div>

          <div className="mt-12">
            {analysesLoading ? (
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600" />
              </div>
            ) : userAnalyses.length === 0 ? (
              <div className="text-center text-gray-500 py-8 bg-white/60 rounded-lg border">
                No analyses yet. Start by searching above.
              </div>
            ) : (
              <>
                {(() => {
                  const inProgressAnalyses = userAnalyses.filter(a => a.status === 'queued' || a.status === 'running');
                  const completedAnalyses = userAnalyses.filter(a => a.status === 'completed');

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                          <Clock className="w-6 h-6 mr-3 text-yellow-600" />
                          In Progress
                        </h2>
                        {inProgressAnalyses.length > 0 ? (
                          <div className="grid gap-4">
                            {inProgressAnalyses.map((analysis) => (
                              <div key={analysis.id} className="bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                                    <Building2 className="w-5 h-5 text-yellow-700" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-gray-900">{analysis.brands?.name || 'Unknown Brand'}</h3>
                                    <p className="text-sm text-gray-500">Status: <span className="font-medium capitalize">{analysis.status}</span></p>
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedAnalysis(analysis)}>View Status</Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-gray-500 py-8 bg-white/60 rounded-lg border">
                            No analyses are currently in progress.
                          </div>
                        )}
                      </div>

                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                          <CheckCircle className="w-6 h-6 mr-3 text-green-600" />
                          Completed Analyses
                        </h2>
                        {completedAnalyses.length > 0 ? (
                          <div className="grid gap-4">
                            {completedAnalyses.map((analysis) => (
                              <div key={analysis.id} className="bg-white/60 backdrop-blur-sm rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-green-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                                    <Building2 className="w-5 h-5 text-green-700" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-gray-900">{analysis.brands?.name || 'Unknown Brand'}</h3>
                                    <p className="text-sm text-gray-500">Completed: {new Date(analysis.updated_at || analysis.created_at).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedAnalysis(analysis)}>View Results</Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-gray-500 py-8 bg-white/60 rounded-lg border">
                            No analyses have been completed yet.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}