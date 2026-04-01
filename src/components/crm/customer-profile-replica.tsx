"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  ArrowLeft, MessageSquare, Phone, MapPin, AlertTriangle, DollarSign, Package, TrendingUp, Bot, 
  Mail, Download, Plus, Edit, Save, X, FileText, Clock, Tag, Bell, Copy, Trash2, Send, Calendar, Eye, Upload,
  TrendingDown, Activity, Shield, Target, Zap, Wallet, CreditCard, Timer, Users, Factory, 
  Ship, Truck, Globe, BarChart3, PieChart, LineChart, ArrowUpRight, ArrowDownRight, Info,
  CheckCircle, XCircle, AlertCircle, Sparkles, Brain, ShoppingCart, Search, Filter, Star,
  Briefcase, Award, Flame, Rocket, TrendingUpDown, Percent, Box, Route, Anchor
} from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// ENHANCED DATA STRUCTURES WITH INTELLIGENCE LAYER
// ============================================================================

const customer = {
  id: "1",
  name: "Okoye Electronics Ltd",
  phone: "+234 801 234 5678",
  email: "contact@okoyeelectronics.ng",
  country: "Nigeria",
  city: "Lagos",
  address: "123 Market Street, Lagos Island",
  whatsappStatus: "Active",
  ordersCount: 12,
  lifetimeValue: "$124,500",
  tags: ["VIP", "Importer"],
  riskScore: "Low",
  riskPercentage: 15,
  joinedDate: "Jan 2023",
  lastContact: "2 hours ago",
  accountManager: "Sarah Johnson",
  onboardedBy: "Awa Mbemba",
  collaborators: ["Jean Kouamé", "Awa Mbemba"],
  paymentTerms: "30 days",
  preferredCurrency: "USD",
  
  // FINANCIAL INTELLIGENCE
  financialIntelligence: {
    lifetimeGrossRevenue: 124500,
    lifetimeNetProfit: 38600,
    averageMargin: 31.0,
    cashAtRisk: 24500, // Money currently tied in China/transit/customs
    daysOfCashImmobilization: 42,
    customerAcquisitionCost: 850,
    paybackPeriod: 8, // days
    contributionScore: 94, // 0-100 scale of importance to Horion's cashflow
    revenueGrowth: 23.5, // % YoY
    profitGrowth: 18.2,
    avgOrderValue: 10375,
    orderFrequency: 28, // days
    lastOrderDays: 3,
  },
  
  // FUTURE PIPELINE INTELLIGENCE
  futurePipeline: [
    {
      id: 1,
      product: "Samsung Galaxy S24 (200 units)",
      stage: "Tracking",
      estimatedValue: 45000,
      probability: 85,
      expectedCloseDate: "2026-01-25",
      lastInteraction: "2h ago",
      aiNotes: "Customer asked for detailed specs and pricing"
    },
    {
      id: 2,
      product: "MacBook Air M3 (50 units)",
      stage: "Quoted",
      estimatedValue: 62000,
      probability: 65,
      expectedCloseDate: "2026-02-05",
      lastInteraction: "1d ago",
      aiNotes: "Quote sent, waiting for budget approval"
    },
    {
      id: 3,
      product: "Sony 65\" OLED TVs (80 units)",
      stage: "Negotiating",
      estimatedValue: 78000,
      probability: 90,
      expectedCloseDate: "2026-01-30",
      lastInteraction: "5h ago",
      aiNotes: "Price agreed, finalizing shipping terms"
    },
  ],
  
  // RISK ENGINE
  riskEngine: {
    globalRiskScore: 18, // 0-100, lower is better
    paymentRisk: 5, // Perfect payment history
    logisticsRisk: 15, // Some delays in Nigeria customs
    customsRisk: 25, // Nigeria customs complexity
    disputeFrequency: 0,
    supplierReliability: 92, // Average across all suppliers used
    countryRisk: 35, // Nigeria regulatory environment
    fraudRisk: 2,
    operationalRisk: 12,
    cashExposure: 24500, // Current exposure
    maxRecommendedExposure: 100000,
    exposureUtilization: 24.5, // %
  },
  
  // SUPPLY CHAIN INTELLIGENCE
  supplyChain: {
    preferredSuppliers: [
      {
        id: "SUP-001",
        name: "Shenzhen Electronics Hub",
        category: "Consumer Electronics",
        ordersCount: 8,
        reliabilityScore: 96,
        avgLeadTime: 22,
        qcPassRate: 98,
        onTimeDelivery: 94,
        disputes: 0,
      },
      {
        id: "SUP-003",
        name: "Guangzhou Mobile Tech",
        category: "Smartphones & Tablets",
        ordersCount: 4,
        reliabilityScore: 88,
        avgLeadTime: 28,
        qcPassRate: 92,
        onTimeDelivery: 87,
        disputes: 1,
      },
    ],
    preferredRoutes: [
      {
        id: 1,
        route: "Shenzhen ? Lagos (Sea)",
        ordersCount: 9,
        avgTransitTime: 35,
        reliability: 89,
        lastDelay: 5, // days
        customsClearance: 7, // avg days
      },
      {
        id: 2,
        route: "Guangzhou ? Lagos (Sea)",
        ordersCount: 3,
        avgTransitTime: 38,
        reliability: 85,
        lastDelay: 8,
        customsClearance: 9,
      },
    ],
    totalSuppliers: 5,
    totalRoutes: 2,
    qcIssues: 2, // Historical
    customsIssues: 3,
    avgEndToEndTime: 52, // days from order to delivery
  },
  
  // STRATEGIC CLASSIFICATION
  strategicClass: {
    primary: "Cashflow Driver",
    secondary: ["Key Account", "Strategic Growth Client"],
    segments: {
      isCashflowDriver: true,
      isStrategicGrowth: true,
      isHighRiskHighReward: false,
      isLowMarginVolume: false,
      isTestClient: false,
      isOneTimeBuyer: false,
      isKeyAccount: true,
      isAtRisk: false,
    },
    classification: {
      tier: "Platinum",
      value: "High",
      growth: "Rapid",
      stability: "Excellent",
    }
  },
  
  // AI CUSTOMER BRAIN
  aiBrain: {
    buyingPersonality: {
      primary: "Quality-Driven",
      traits: ["Price-Conscious", "Brand-Focused", "Repeat Buyer"],
      decisionSpeed: "Fast", // Fast, Medium, Slow
      riskTolerance: "Medium",
    },
    negotiationStyle: {
      style: "Collaborative",
      priceFlexibility: "Medium", // High, Medium, Low
      volumeDiscountSensitivity: "High",
      paymentTermsImportance: "Medium",
      commonTactics: ["Bulk order commitments", "Multi-product bundling"],
    },
    sensitivities: {
      delayTolerance: "Low", // Will complain if delayed > 3 days
      qualityExpectations: "High",
      priceSensitivity: "Medium",
      communicationPreference: "WhatsApp",
      responseTimeExpectation: "< 2 hours",
    },
    recommendations: {
      pricingStrategy: "Premium positioning with volume discounts",
      paymentTerms: "Standard 30-day terms, prepayment discount optional",
      logisticsStrategy: "Prioritize fast routes, air freight for urgent orders",
      communicationStrategy: "Proactive updates, weekly check-ins",
    },
    upsellOpportunities: [
      {
        product: "Extended Warranty Package",
        probability: 75,
        estimatedValue: 3200,
        reasoning: "High quality expectations, history of claiming defects"
      },
      {
        product: "Premium Accessories Bundle",
        probability: 60,
        estimatedValue: 5800,
        reasoning: "Often buys accessories separately, bundle saves time"
      },
      {
        product: "White Label Service",
        probability: 45,
        estimatedValue: 8500,
        reasoning: "Growing brand, expressed interest in private labeling"
      },
    ],
    crossSellSuggestions: [
      "Smart Home Devices (IoT category)",
      "Gaming Consoles & Accessories",
      "Professional Audio Equipment",
    ],
    behaviorPatterns: {
      orderingCycle: "Every 3-4 weeks",
      peakOrderingPeriod: "Beginning of month",
      preferredOrderSize: "$15,000-25,000",
      productDiversity: "High", // Orders across multiple categories
      brandLoyalty: "Samsung, Sony, Apple",
    }
  },
  
  // CROSS-MODULE INTELLIGENCE
  crossModuleData: {
    marketingAttribution: {
      acquisitionChannel: "WhatsApp Group",
      campaignSource: "Electronics Importers Q1 2023",
      totalCampaignSpend: 850,
      roiMultiple: 146.5, // 146x return
    },
    whatsappGroups: ["VIP Electronics Hub", "Nigeria Tech Importers"],
    assignedAIAgents: ["Zelia - Sales", "Marcus - Logistics"],
    recentCampaigns: [
      { name: "Q1 2024 Electronics Sale", responseRate: "Clicked", conversion: true },
      { name: "New Year Mega Deals", responseRate: "Viewed", conversion: false },
    ],
    topProducts: [
      { name: "Smartphones", orders: 4, revenue: 48200 },
      { name: "Laptops", orders: 3, revenue: 32100 },
      { name: "TVs", orders: 3, revenue: 28900 },
      { name: "Tablets", orders: 2, revenue: 15300 },
    ],
  },
};

const whatsappHistory = [
  { id: 1, date: "2024-01-13 14:30", sender: "Customer", message: "Hello, I need a quote for 100 LED TVs 55 inch", status: "read" },
  { id: 2, date: "2024-01-13 14:35", sender: "Horion", message: "Hello! I'll get you a quote right away. What's your target price range?", status: "read" },
  { id: 3, date: "2024-01-13 14:40", sender: "Customer", message: "Looking for around $250-280 per unit including shipping to Lagos", status: "read" },
  { id: 4, date: "2024-01-13 14:45", sender: "Horion", message: "I've found 3 suppliers. Best option: $265/unit, Shenzhen Display Co, 30 day delivery", status: "read" },
  { id: 5, date: "2024-01-13 15:00", sender: "Customer", message: "Perfect! Let's proceed with this supplier", status: "read" },
  { id: 6, date: "2024-01-13 15:05", sender: "Horion", message: "Great! I'm preparing the invoice now. Total: $26,500. Payment options sent.", status: "delivered" },
];

const orders = [
  { id: "HRN-2341", date: "Jan 10, 2024", product: "LED TVs 55inch", quantity: 100, amount: "$24,500", status: "In Transit", margin: "$6,800", location: "Shanghai Port", eta: "Jan 25" },
  { id: "HRN-2298", date: "Dec 15, 2023", product: "Laptops HP", quantity: 50, amount: "$18,200", status: "Delivered", margin: "$5,100", location: "Lagos", eta: "Delivered" },
  { id: "HRN-2245", date: "Nov 20, 2023", product: "Smartphones", quantity: 200, amount: "$32,100", status: "Delivered", margin: "$9,200", location: "Lagos", eta: "Delivered" },
  { id: "HRN-2189", date: "Oct 05, 2023", product: "Tablets Samsung", quantity: 80, amount: "$15,800", status: "Delivered", margin: "$4,500", location: "Lagos", eta: "Delivered" },
  { id: "HRN-2134", date: "Sep 12, 2023", product: "Power Banks", quantity: 500, amount: "$12,400", status: "Delivered", margin: "$3,800", location: "Lagos", eta: "Delivered" },
];

const payments = [
  { id: 1, date: "Jan 10, 2024", orderId: "HRN-2341", amount: "$24,500", method: "Bank Transfer", status: "Completed" },
  { id: 2, date: "Dec 15, 2023", orderId: "HRN-2298", amount: "$18,200", method: "Bank Transfer", status: "Completed" },
  { id: 3, date: "Nov 20, 2023", orderId: "HRN-2245", amount: "$32,100", method: "Bank Transfer", status: "Completed" },
  { id: 4, date: "Oct 05, 2023", orderId: "HRN-2189", amount: "$15,800", method: "Wire Transfer", status: "Completed" },
  { id: 5, date: "Sep 12, 2023", orderId: "HRN-2134", amount: "$12,400", method: "Bank Transfer", status: "Completed" },
];

const complaints = [
  { id: 1, date: "Dec 20, 2023", orderId: "HRN-2298", issue: "2 laptops arrived with screen defects", status: "Resolved", resolution: "Replacement sent", priority: "High" },
  { id: 2, date: "Oct 10, 2023", orderId: "HRN-2189", issue: "Delayed shipment by 5 days", status: "Resolved", resolution: "10% discount applied", priority: "Medium" },
];

const activities = [
  { id: 1, date: "2024-01-13 15:05", type: "message", description: "WhatsApp message sent: Quote prepared", user: "System" },
  { id: 2, date: "2024-01-13 14:30", type: "message", description: "WhatsApp message received from customer", user: "System" },
  { id: 3, date: "2024-01-10 10:20", type: "order", description: "New order created: HRN-2341", user: "Sarah Johnson" },
  { id: 4, date: "2024-01-10 10:15", type: "note", description: "Added note: Customer interested in new TV models", user: "Sarah Johnson" },
  { id: 5, date: "2024-01-08 16:30", type: "call", description: "Phone call: 15 minutes discussion about Q1 orders", user: "Sarah Johnson" },
];

const documents = [
  { id: 1, name: "Business License.pdf", type: "License", uploadDate: "Jan 2023", size: "2.4 MB" },
  { id: 2, name: "Tax Certificate.pdf", type: "Tax Document", uploadDate: "Jan 2023", size: "1.2 MB" },
  { id: 3, name: "Contract Agreement.pdf", type: "Contract", uploadDate: "Feb 2023", size: "3.1 MB" },
];

export function CustomerProfileReplica() {
    const router = useRouter();
  const backHref = "/demo";
  const [activeTab, setActiveTab] = useState("intelligence");
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showSendMessageDialog, setShowSendMessageDialog] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newMessage, setNewMessage] = useState("");
  
  // Calculate weighted pipeline value
  const weightedPipelineValue = customer.futurePipeline.reduce((sum, item) => 
    sum + (item.estimatedValue * item.probability / 100), 0
  );
  
  // Calculate average customer benchmarks (mock)
  const avgCustomerBenchmark = {
    lifetimeNetProfit: 18500,
    averageMargin: 24.5,
    daysOfCashImmobilization: 58,
    contributionScore: 45,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "In Transit": return "bg-blue-100 text-blue-700";
      case "Delivered": return "bg-green-100 text-green-700";
      case "Processing": return "bg-yellow-100 text-yellow-700";
      case "Cancelled": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getRiskColor = (score: number) => {
    if (score <= 20) return { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", label: "LOW RISK" };
    if (score <= 50) return { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", label: "MEDIUM RISK" };
    return { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "HIGH RISK" };
  };

  const getClassificationIcon = (classification: string) => {
    switch (classification) {
      case "Cashflow Driver": return Wallet;
      case "Strategic Growth Client": return Rocket;
      case "Key Account": return Award;
      case "High-Risk High-Reward": return Flame;
      case "Low Margin Volume Client": return Box;
      default: return Target;
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case "Cashflow Driver": return "bg-green-100 text-green-700 border-green-300";
      case "Strategic Growth Client": return "bg-blue-100 text-blue-700 border-blue-300";
      case "Key Account": return "bg-purple-100 text-purple-700 border-purple-300";
      case "High-Risk High-Reward": return "bg-orange-100 text-orange-700 border-orange-300";
      case "Low Margin Volume Client": return "bg-gray-100 text-gray-700 border-gray-300";
      default: return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-auto bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  onClick={() => router.push(backHref)}
                  className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-[#010150]">{customer.name}</h1>
                    {/* Strategic Classification Badges */}
                    <Badge className={`px-3 py-1 border font-semibold ${getClassificationColor(customer.strategicClass.primary)}`}>
                      {customer.strategicClass.primary}
                    </Badge>
                    <Badge className="bg-[#DBA000] text-[#010150] px-3 py-1 font-semibold">
                      {customer.strategicClass.classification.tier}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {customer.city}, {customer.country}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Client depuis {customer.joinedDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Dernier contact : {customer.lastContact}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      Intégré par {customer.onboardedBy}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      Responsable de compte {customer.accountManager}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setShowSendMessageDialog(true)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
                <Button 
                  onClick={() => toast.info("Opening email client...")}
                  className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
                <Button
                  onClick={() => setShowEditDialog(true)}
                  className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Modifier
                </Button>
                <Button
                  onClick={() => toast.success("Données client exportées")}
                  className="bg-[#010150] hover:bg-[#010150]/90 text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exporter
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-white border border-gray-200 p-1">
              <TabsTrigger value="intelligence" className="data-[state=active]:bg-[#010150] data-[state=active]:text-white">
                <Brain className="w-4 h-4 mr-2" />
                Tableau de bord intelligence
              </TabsTrigger>
              <TabsTrigger value="financial" className="data-[state=active]:bg-[#010150] data-[state=active]:text-white">
                <DollarSign className="w-4 h-4 mr-2" />
                Performance financière
              </TabsTrigger>
              <TabsTrigger value="pipeline" className="data-[state=active]:bg-[#010150] data-[state=active]:text-white">
                <Target className="w-4 h-4 mr-2" />
                Pipeline futur
              </TabsTrigger>
              <TabsTrigger value="risk" className="data-[state=active]:bg-[#010150] data-[state=active]:text-white">
                <Shield className="w-4 h-4 mr-2" />
                Risque & exposition
              </TabsTrigger>
              <TabsTrigger value="supply" className="data-[state=active]:bg-[#010150] data-[state=active]:text-white">
                <Ship className="w-4 h-4 mr-2" />
                Chaîne logistique
              </TabsTrigger>
              <TabsTrigger value="ai" className="data-[state=active]:bg-[#010150] data-[state=active]:text-white">
                <Sparkles className="w-4 h-4 mr-2" />
                IA Client
              </TabsTrigger>
              <TabsTrigger value="timeline" className="data-[state=active]:bg-[#010150] data-[state=active]:text-white">
                <Clock className="w-4 h-4 mr-2" />
                {"Fil d'activité"}
              </TabsTrigger>
              <TabsTrigger value="orders" className="data-[state=active]:bg-[#010150] data-[state=active]:text-white">
                <Package className="w-4 h-4 mr-2" />
                Commandes & historique
              </TabsTrigger>
            </TabsList>

            {/* INTELLIGENCE DASHBOARD TAB */}
            <TabsContent value="intelligence" className="space-y-6">
              {/* Quick Stats Row */}
              <div className="grid grid-cols-5 gap-4">
                <Card className="p-4 border-2 border-green-200 bg-green-50">
                  <div className="flex items-center justify-between mb-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <ArrowUpRight className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold text-[#010150]">${(customer.financialIntelligence.lifetimeNetProfit / 1000).toFixed(1)}K</p>
                  <p className="text-xs text-gray-600 mt-1">Bénéfice net (LTD)</p>
                  <p className="text-xs text-green-600 font-medium mt-1">+{customer.financialIntelligence.profitGrowth}% annuel</p>
                </Card>

                <Card className="p-4 border-2 border-blue-200 bg-blue-50">
                  <div className="flex items-center justify-between mb-2">
                    <Percent className="w-5 h-5 text-blue-600" />
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-[#010150]">{customer.financialIntelligence.averageMargin}%</p>
                  <p className="text-xs text-gray-600 mt-1">Marge moyenne</p>
                  <p className="text-xs text-gray-500 font-medium mt-1">vs {avgCustomerBenchmark.averageMargin}% moy.</p>
                </Card>

                <Card className="p-4 border-2 border-purple-200 bg-purple-50">
                  <div className="flex items-center justify-between mb-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    <Badge className="bg-purple-600 text-white text-xs px-2 py-0">Top 5%</Badge>
                  </div>
                  <p className="text-2xl font-bold text-[#010150]">{customer.financialIntelligence.contributionScore}</p>
                  <p className="text-xs text-gray-600 mt-1">Score de contribution</p>
                  <p className="text-xs text-purple-600 font-medium mt-1">Critique pour la trésorerie</p>
                </Card>

                <Card className="p-4 border-2 border-orange-200 bg-orange-50">
                  <div className="flex items-center justify-between mb-2">
                    <Wallet className="w-5 h-5 text-orange-600" />
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                  </div>
                  <p className="text-2xl font-bold text-[#010150]">${(customer.financialIntelligence.cashAtRisk / 1000).toFixed(1)}K</p>
                  <p className="text-xs text-gray-600 mt-1">Cash at Risk</p>
                  <p className="text-xs text-orange-600 font-medium mt-1">{customer.financialIntelligence.daysOfCashImmobilization}d immobilized</p>
                </Card>

                <Card className="p-4 border-2 border-[#5F27CD] bg-purple-50">
                  <div className="flex items-center justify-between mb-2">
                    <ShoppingCart className="w-5 h-5 text-[#5F27CD]" />
                    <Zap className="w-4 h-4 text-[#5F27CD]" />
                  </div>
                  <p className="text-2xl font-bold text-[#010150]">${(weightedPipelineValue / 1000).toFixed(1)}K</p>
                  <p className="text-xs text-gray-600 mt-1">Valeur pipeline</p>
                  <p className="text-xs text-[#5F27CD] font-medium mt-1">{customer.futurePipeline.length} opportunités</p>
                </Card>
              </div>

              {/* Main Intelligence Grid */}
              <div className="grid grid-cols-3 gap-6">
                {/* Financial Performance Summary */}
                <Card className="p-5 border-2 border-[#010150]">
                  <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center">
                    <DollarSign className="w-4 h-4 mr-2 text-[#DBA000]" />
                    Performance financière
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <span className="text-xs text-gray-600">Chiffre d'affaires brut</span>
                      <span className="text-sm font-bold text-[#010150]">${(customer.financialIntelligence.lifetimeGrossRevenue / 1000).toFixed(1)}K</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                      <span className="text-xs text-gray-600">Bénéfice net</span>
                      <span className="text-sm font-bold text-green-600">${(customer.financialIntelligence.lifetimeNetProfit / 1000).toFixed(1)}K</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                      <span className="text-xs text-gray-600">Valeur moy. commande</span>
                      <span className="text-sm font-bold text-blue-600">${(customer.financialIntelligence.avgOrderValue / 1000).toFixed(1)}K</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
                      <span className="text-xs text-gray-600">Fréquence commandes</span>
                      <span className="text-sm font-bold text-purple-600">Tous les {customer.financialIntelligence.orderFrequency}j</span>
                    </div>
                  </div>
                  <Button className="w-full mt-4 bg-[#010150] hover:bg-[#010150]/90 text-white text-xs">
                    Voir le rapport financier complet
                  </Button>
                </Card>

                {/* Risk Score Overview */}
                <Card className="p-5 border-2 border-[#010150]">
                  <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center">
                    <Shield className="w-4 h-4 mr-2 text-[#5F27CD]" />
                    Évaluation du risque
                  </h3>
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 border-4 border-green-600 mb-2">
                      <span className="text-2xl font-bold text-green-600">{customer.riskEngine.globalRiskScore}</span>
                    </div>
                    <p className="text-xs font-bold text-green-600">RISQUE FAIBLE</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Risque paiement</span>
                      <Badge className="bg-green-100 text-green-700 px-2 py-0">{customer.riskEngine.paymentRisk}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Risque logistique</span>
                      <Badge className="bg-green-100 text-green-700 px-2 py-0">{customer.riskEngine.logisticsRisk}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Risque douanier</span>
                      <Badge className="bg-yellow-100 text-yellow-700 px-2 py-0">{customer.riskEngine.customsRisk}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Risque pays</span>
                      <Badge className="bg-yellow-100 text-yellow-700 px-2 py-0">{customer.riskEngine.countryRisk}</Badge>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
                    <p className="text-xs text-gray-700">
                      <CheckCircle className="w-3 h-3 inline text-green-600 mr-1" />
                      Exposition sécurisée jusqu'à <strong>${(customer.riskEngine.maxRecommendedExposure / 1000).toFixed(0)}K</strong>
                    </p>
                  </div>
                </Card>

                {/* AI Brain Summary */}
                <Card className="p-5 border-2 border-[#5F27CD] bg-gradient-to-br from-purple-50 to-blue-50">
                  <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center">
                    <Brain className="w-4 h-4 mr-2 text-[#5F27CD]" />
                    IA Client
                  </h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-white rounded border border-purple-200">
                      <p className="text-xs text-gray-600 mb-1">Profil acheteur</p>
                      <p className="text-sm font-bold text-[#010150]">{customer.aiBrain.buyingPersonality.primary}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {customer.aiBrain.buyingPersonality.traits.map(trait => (
                          <Badge key={trait} className="bg-purple-100 text-purple-700 text-xs px-2 py-0">{trait}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="p-3 bg-white rounded border border-blue-200">
                      <p className="text-xs text-gray-600 mb-1">Style de négociation</p>
                      <p className="text-sm font-bold text-[#010150]">{customer.aiBrain.negotiationStyle.style}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Flexibilité prix : {customer.aiBrain.negotiationStyle.priceFlexibility}
                      </p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                      <p className="text-xs text-gray-600 mb-1 flex items-center">
                        <Sparkles className="w-3 h-3 mr-1" />
                        {"Meilleure opportunité d'upsell"}
                      </p>
                      <p className="text-sm font-bold text-[#010150]">{customer.aiBrain.upsellOpportunities[0].product}</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        {customer.aiBrain.upsellOpportunities[0].probability}% probability • ${(customer.aiBrain.upsellOpportunities[0].estimatedValue / 1000).toFixed(1)}K
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Secondary Intelligence Grid */}
              <div className="grid grid-cols-2 gap-6">
                {/* Pipeline Opportunities */}
                <Card className="p-5 border-2 border-purple-200">
                  <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center justify-between">
                    <span className="flex items-center">
                      <Target className="w-4 h-4 mr-2 text-purple-600" />
                      Pipeline actif
                    </span>
                    <Badge className="bg-purple-100 text-purple-700 px-2 py-1">{customer.futurePipeline.length} deals</Badge>
                  </h3>
                  <div className="space-y-3">
                    {customer.futurePipeline.map((item) => (
                      <div key={item.id} className="p-3 bg-gray-50 rounded border border-gray-200 hover:border-purple-300 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-[#010150]">{item.product}</p>
                            <p className="text-xs text-gray-600 mt-1">{item.aiNotes}</p>
                          </div>
                          <Badge className="bg-blue-100 text-blue-700 text-xs px-2 py-0">{item.stage}</Badge>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                          <span className="text-xs text-gray-600">{item.probability}% • ${(item.estimatedValue / 1000).toFixed(1)}K</span>
                          <span className="text-xs text-gray-500">{item.expectedCloseDate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Supply Chain Overview */}
                <Card className="p-5 border-2 border-blue-200">
                  <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center justify-between">
                    <span className="flex items-center">
                      <Ship className="w-4 h-4 mr-2 text-blue-600" />
                      Statut chaîne logistique
                    </span>
                    <Badge className="bg-blue-100 text-blue-700 px-2 py-1">{customer.supplyChain.preferredSuppliers.length} fournisseurs</Badge>
                  </h3>
                  <div className="space-y-3 mb-4">
                    {customer.supplyChain.preferredSuppliers.map((supplier) => (
                      <div key={supplier.id} className="p-3 bg-gray-50 rounded border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-semibold text-[#010150]">{supplier.name}</p>
                          <Badge className={`text-xs px-2 py-0 ${
                            supplier.reliabilityScore >= 90 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {supplier.reliabilityScore}% reliable
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-gray-600">Orders</p>
                            <p className="font-semibold text-[#010150]">{supplier.ordersCount}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">QC Pass</p>
                            <p className="font-semibold text-green-600">{supplier.qcPassRate}%</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Lead Time</p>
                            <p className="font-semibold text-blue-600">{supplier.avgLeadTime}d</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-xs text-gray-700 flex items-center">
                      <Clock className="w-3 h-3 mr-1 text-blue-600" />
                      Avg End-to-End: <strong className="ml-1">{customer.supplyChain.avgEndToEndTime} days</strong>
                    </p>
                  </div>
                </Card>
              </div>

              {/* Cross-Module Connections */}
              <Card className="p-5 border-2 border-[#DBA000]">
                <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center">
                  <Activity className="w-4 h-4 mr-2 text-[#DBA000]" />
                  Intelligence multi-modules
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 bg-green-50 rounded border border-green-200">
                    <MessageSquare className="w-6 h-6 text-green-600 mb-2" />
                    <p className="text-xs text-gray-600 mb-1">Groupes WhatsApp</p>
                    <p className="text-sm font-bold text-[#010150]">{customer.crossModuleData.whatsappGroups.length}</p>
                    <p className="text-xs text-gray-600 mt-1">{customer.crossModuleData.whatsappGroups.join(", ")}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded border border-blue-200">
                    <Bot className="w-6 h-6 text-blue-600 mb-2" />
                    <p className="text-xs text-gray-600 mb-1">Agents IA</p>
                    <p className="text-sm font-bold text-[#010150]">{customer.crossModuleData.assignedAIAgents.length}</p>
                    <p className="text-xs text-gray-600 mt-1">{customer.crossModuleData.assignedAIAgents[0]}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded border border-purple-200">
                    <BarChart3 className="w-6 h-6 text-purple-600 mb-2" />
                    <p className="text-xs text-gray-600 mb-1">ROI Marketing</p>
                    <p className="text-sm font-bold text-purple-600">{customer.crossModuleData.marketingAttribution.roiMultiple}x</p>
                    <p className="text-xs text-gray-600 mt-1">Via {customer.crossModuleData.marketingAttribution.acquisitionChannel}</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded border border-orange-200">
                    <Package className="w-6 h-6 text-orange-600 mb-2" />
                    <p className="text-xs text-gray-600 mb-1">Produit principal</p>
                    <p className="text-sm font-bold text-[#010150]">{customer.crossModuleData.topProducts[0].name}</p>
                    <p className="text-xs text-orange-600 mt-1">${(customer.crossModuleData.topProducts[0].revenue / 1000).toFixed(1)}K CA</p>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* FINANCIAL PERFORMANCE TAB */}
            <TabsContent value="financial" className="space-y-6">
              {/* Financial KPI Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="p-4 border-2 border-green-200 bg-green-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Chiffre d'affaires brut cumulé</p>
                      <p className="text-2xl font-bold text-[#010150]">${(customer.financialIntelligence.lifetimeGrossRevenue / 1000).toFixed(1)}K</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Croissance annuelle</span>
                    <span className="text-green-600 font-semibold flex items-center">
                      <ArrowUpRight className="w-3 h-3 mr-1" />
                      +{customer.financialIntelligence.revenueGrowth}%
                    </span>
                  </div>
                </Card>

                <Card className="p-4 border-2 border-blue-200 bg-blue-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Bénéfice net cumulé</p>
                      <p className="text-2xl font-bold text-[#010150]">${(customer.financialIntelligence.lifetimeNetProfit / 1000).toFixed(1)}K</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">vs client moyen</span>
                    <span className="text-blue-600 font-semibold">
                      +{((customer.financialIntelligence.lifetimeNetProfit / avgCustomerBenchmark.lifetimeNetProfit - 1) * 100).toFixed(0)}%
                    </span>
                  </div>
                </Card>

                <Card className="p-4 border-2 border-purple-200 bg-purple-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Marge moyenne</p>
                      <p className="text-2xl font-bold text-[#010150]">{customer.financialIntelligence.averageMargin}%</p>
                    </div>
                    <Percent className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Moy. secteur</span>
                    <span className="text-purple-600 font-semibold">{avgCustomerBenchmark.averageMargin}%</span>
                  </div>
                </Card>

                <Card className="p-4 border-2 border-orange-200 bg-orange-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Score de contribution</p>
                      <p className="text-2xl font-bold text-[#010150]">{customer.financialIntelligence.contributionScore}</p>
                    </div>
                    <Star className="w-8 h-8 text-orange-600" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Classement</span>
                    <Badge className="bg-orange-600 text-white px-2 py-0">Top 5%</Badge>
                  </div>
                </Card>
              </div>

              {/* Cash Management Section */}
              <div className="grid grid-cols-2 gap-6">
                <Card className="p-5 border-2 border-[#010150]">
                  <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center">
                    <Wallet className="w-4 h-4 mr-2 text-[#DBA000]" />
                    Cash Flow Analysis
                  </h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-red-50 rounded border-2 border-red-200">
                      <p className="text-xs text-gray-600 mb-1">Cash Currently at Risk</p>
                      <p className="text-3xl font-bold text-red-600">${(customer.financialIntelligence.cashAtRisk / 1000).toFixed(1)}K</p>
                      <p className="text-xs text-gray-600 mt-2">
                        <AlertTriangle className="w-3 h-3 inline text-red-600 mr-1" />
                        Money tied in China, transit & customs
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-gray-50 rounded">
                        <p className="text-xs text-gray-600 mb-1">Days Cash Immobilized</p>
                        <p className="text-xl font-bold text-[#010150]">{customer.financialIntelligence.daysOfCashImmobilization}d</p>
                        <p className="text-xs text-gray-500 mt-1">vs {avgCustomerBenchmark.daysOfCashImmobilization}d avg</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded">
                        <p className="text-xs text-gray-600 mb-1">Cash Velocity</p>
                        <p className="text-xl font-bold text-green-600">Fast</p>
                        <p className="text-xs text-gray-500 mt-1">28d order cycle</p>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-5 border-2 border-[#010150]">
                  <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center">
                    <CreditCard className="w-4 h-4 mr-2 text-[#5F27CD]" />
                    Customer Economics
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs text-gray-600 mb-1">CAC</p>
                        <p className="text-xl font-bold text-blue-600">${customer.financialIntelligence.customerAcquisitionCost}</p>
                        <p className="text-xs text-gray-600 mt-1">Acquisition Cost</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded border border-green-200">
                        <p className="text-xs text-gray-600 mb-1">Payback Period</p>
                        <p className="text-xl font-bold text-green-600">{customer.financialIntelligence.paybackPeriod}d</p>
                        <p className="text-xs text-gray-600 mt-1">Fast ROI</p>
                      </div>
                    </div>
                    <div className="p-4 bg-purple-50 rounded border-2 border-purple-200">
                      <p className="text-xs text-gray-600 mb-2">LTV / CAC Ratio</p>
                      <p className="text-3xl font-bold text-purple-600">
                        {(customer.financialIntelligence.lifetimeNetProfit / customer.financialIntelligence.customerAcquisitionCost).toFixed(1)}x
                      </p>
                      <p className="text-xs text-green-600 font-medium mt-2">
                        <CheckCircle className="w-3 h-3 inline mr-1" />
                        Excellent customer economics
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Order Economics */}
              <Card className="p-5 border-2 border-[#010150]">
                <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center justify-between">
                  <span className="flex items-center">
                    <Package className="w-4 h-4 mr-2 text-[#DBA000]" />
                    Order Economics & Behavior
                  </span>
                  <Badge className="bg-[#DBA000] text-[#010150] px-3 py-1">{customer.ordersCount} orders</Badge>
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 rounded border border-gray-200">
                    <p className="text-xs text-gray-600 mb-2">Average Order Value</p>
                    <p className="text-2xl font-bold text-[#010150]">${(customer.financialIntelligence.avgOrderValue / 1000).toFixed(1)}K</p>
                    <Progress value={65} className="mt-2 h-2" />
                  </div>
                  <div className="p-4 bg-gray-50 rounded border border-gray-200">
                    <p className="text-xs text-gray-600 mb-2">Order Frequency</p>
                    <p className="text-2xl font-bold text-[#010150]">{customer.financialIntelligence.orderFrequency}d</p>
                    <p className="text-xs text-green-600 mt-2 font-medium">Every ~4 weeks</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded border border-gray-200">
                    <p className="text-xs text-gray-600 mb-2">Last Order</p>
                    <p className="text-2xl font-bold text-[#010150]">{customer.financialIntelligence.lastOrderDays}d</p>
                    <p className="text-xs text-blue-600 mt-2 font-medium">ago</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded border border-green-200">
                    <p className="text-xs text-gray-600 mb-2">Next Expected</p>
                    <p className="text-2xl font-bold text-green-600">~25d</p>
                    <p className="text-xs text-gray-600 mt-2">Feb 8, 2026</p>
                  </div>
                </div>
              </Card>

              {/* Comparison vs Average Customer */}
              <Card className="p-5 border-2 border-[#5F27CD] bg-gradient-to-r from-purple-50 to-blue-50">
                <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center">
                  <BarChart3 className="w-4 h-4 mr-2 text-[#5F27CD]" />
                  Performance vs Average Customer
                </h3>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-gray-600 mb-3">Net Profit Comparison</p>
                    <div className="space-y-2">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">This Customer</span>
                          <span className="font-bold text-green-600">${(customer.financialIntelligence.lifetimeNetProfit / 1000).toFixed(1)}K</span>
                        </div>
                        <Progress value={100} className="h-2 bg-gray-200" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">Average Customer</span>
                          <span className="font-bold text-gray-600">${(avgCustomerBenchmark.lifetimeNetProfit / 1000).toFixed(1)}K</span>
                        </div>
                        <Progress value={48} className="h-2 bg-gray-200" />
                      </div>
                    </div>
                    <p className="text-xs text-green-600 font-bold mt-2">
                      +109% above average
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-3">Margin Comparison</p>
                    <div className="space-y-2">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">This Customer</span>
                          <span className="font-bold text-green-600">{customer.financialIntelligence.averageMargin}%</span>
                        </div>
                        <Progress value={100} className="h-2 bg-gray-200" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">Average Customer</span>
                          <span className="font-bold text-gray-600">{avgCustomerBenchmark.averageMargin}%</span>
                        </div>
                        <Progress value={79} className="h-2 bg-gray-200" />
                      </div>
                    </div>
                    <p className="text-xs text-green-600 font-bold mt-2">
                      +26% higher margin
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-3">Cash Efficiency</p>
                    <div className="space-y-2">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">This Customer</span>
                          <span className="font-bold text-green-600">{customer.financialIntelligence.daysOfCashImmobilization}d</span>
                        </div>
                        <Progress value={72} className="h-2 bg-gray-200" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">Average Customer</span>
                          <span className="font-bold text-gray-600">{avgCustomerBenchmark.daysOfCashImmobilization}d</span>
                        </div>
                        <Progress value={100} className="h-2 bg-gray-200" />
                      </div>
                    </div>
                    <p className="text-xs text-green-600 font-bold mt-2">
                      28% faster cash cycle
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Add other tab contents here... (continued in next message due to length) */}
            
            {/* FUTURE PIPELINE TAB */}
            <TabsContent value="pipeline" className="space-y-6">
              {/* Pipeline Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="p-4 border-2 border-purple-200 bg-purple-50">
                  <div className="flex items-center justify-between mb-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    <Badge className="bg-purple-600 text-white text-xs px-2 py-0">{customer.futurePipeline.length}</Badge>
                  </div>
                  <p className="text-2xl font-bold text-[#010150]">${(weightedPipelineValue / 1000).toFixed(1)}K</p>
                  <p className="text-xs text-gray-600 mt-1">Weighted Pipeline Value</p>
                </Card>

                <Card className="p-4 border-2 border-blue-200 bg-blue-50">
                  <div className="flex items-center justify-between mb-2">
                    <ShoppingCart className="w-5 h-5 text-blue-600" />
                    <Percent className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-[#010150]">
                    {(customer.futurePipeline.reduce((sum, p) => sum + p.probability, 0) / customer.futurePipeline.length).toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Avg Close Probability</p>
                </Card>

                <Card className="p-4 border-2 border-green-200 bg-green-50">
                  <div className="flex items-center justify-between mb-2">
                    <Calendar className="w-5 h-5 text-green-600" />
                    <Clock className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold text-[#010150]">~18d</p>
                  <p className="text-xs text-gray-600 mt-1">Avg Time to Close</p>
                </Card>

                <Card className="p-4 border-2 border-[#DBA000] bg-yellow-50">
                  <div className="flex items-center justify-between mb-2">
                    <DollarSign className="w-5 h-5 text-[#DBA000]" />
                    <TrendingUp className="w-4 h-4 text-[#DBA000]" />
                  </div>
                  <p className="text-2xl font-bold text-[#010150]">${(customer.futurePipeline.reduce((sum, p) => sum + p.estimatedValue, 0) / 1000).toFixed(1)}K</p>
                  <p className="text-xs text-gray-600 mt-1">Total Potential Value</p>
                </Card>
              </div>

              {/* Pipeline Opportunities */}
              <Card className="p-5 border-2 border-[#010150]">
                <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center justify-between">
                  <span className="flex items-center">
                    <Target className="w-4 h-4 mr-2 text-purple-600" />
                    Active Opportunities
                  </span>
                  <Button className="bg-[#DBA000] hover:bg-[#DBA000]/90 text-[#010150] text-xs px-3 py-1 h-auto">
                    <Plus className="w-3 h-3 mr-1" />
                    Add Opportunity
                  </Button>
                </h3>
                <div className="space-y-3">
                  {customer.futurePipeline.map((item) => (
                    <Card key={item.id} className="p-4 border-2 border-gray-200 hover:border-purple-300 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-[#010150]">{item.product}</h4>
                            <Badge className={`text-xs px-2 py-0 ${
                              item.stage === 'Negotiating' ? 'bg-yellow-100 text-yellow-700' :
                              item.stage === 'Quoted' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {item.stage}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            <Bot className="w-3 h-3 inline text-[#5F27CD] mr-1" />
                            {item.aiNotes}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-5 gap-4 pt-3 border-t border-gray-200">
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Estimated Value</p>
                          <p className="text-lg font-bold text-[#DBA000]">${(item.estimatedValue / 1000).toFixed(1)}K</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Probability</p>
                          <div className="flex items-center gap-2">
                            <Progress value={item.probability} className="h-2 flex-1" />
                            <span className="text-sm font-bold text-[#010150]">{item.probability}%</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Weighted Value</p>
                          <p className="text-lg font-bold text-green-600">${((item.estimatedValue * item.probability / 100) / 1000).toFixed(1)}K</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Expected Close</p>
                          <p className="text-sm font-semibold text-[#010150]">{item.expectedCloseDate}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 mb-1">Last Interaction</p>
                          <p className="text-sm font-semibold text-blue-600">{item.lastInteraction}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1 h-auto">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Mark as Won
                        </Button>
                        <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 h-auto">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          Follow Up
                        </Button>
                        <Button className="flex-1 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs py-1 h-auto">
                          <Edit className="w-3 h-3 mr-1" />
                          Update
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </Card>

              {/* Products Being Tracked */}
              <Card className="p-5 border-2 border-blue-200 bg-blue-50">
                <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center">
                  <Eye className="w-4 h-4 mr-2 text-blue-600" />
                  Products Customer is Tracking
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {["iPhone 15 Pro", "Dell XPS 15", "Samsung QLED 75\"", "iPad Air M2", "Sony WH-1000XM5", "DJI Mini 4 Pro"].map((product) => (
                    <div key={product} className="p-3 bg-white rounded border border-blue-200 hover:border-blue-400 transition-colors cursor-pointer">
                      <p className="text-sm font-semibold text-[#010150] mb-1">{product}</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Viewed 3x</span>
                        <Badge className="bg-blue-100 text-blue-700 px-2 py-0">Hot</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            {/* RISK & EXPOSURE TAB */}
            <TabsContent value="risk" className="space-y-6">
              {/* Global Risk Score */}
              <div className="grid grid-cols-3 gap-6">
                <Card className="p-6 border-2 border-[#010150] col-span-1">
                  <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center">
                    <Shield className="w-4 h-4 mr-2 text-[#5F27CD]" />
                    Global Risk Score
                  </h3>
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-green-100 border-8 border-green-600 mb-3">
                      <span className="text-4xl font-bold text-green-600">{customer.riskEngine.globalRiskScore}</span>
                    </div>
                    <p className="text-lg font-bold text-green-600 mb-1">LOW RISK</p>
                    <p className="text-xs text-gray-600">Safe for high exposure</p>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Risk Level:</span>
                      <Badge className="bg-green-100 text-green-700 px-2 py-0">Excellent</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Max Exposure:</span>
                      <span className="font-bold text-[#010150]">${(customer.riskEngine.maxRecommendedExposure / 1000).toFixed(0)}K</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Current Utilization:</span>
                      <span className="font-bold text-blue-600">{customer.riskEngine.exposureUtilization.toFixed(1)}%</span>
                    </div>
                  </div>
                </Card>

                {/* Risk Breakdown */}
                <Card className="p-5 border-2 border-[#010150] col-span-2">
                  <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2 text-[#DBA000]" />
                    Risk Breakdown Analysis
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: "Payment Risk", value: customer.riskEngine.paymentRisk, icon: CreditCard, max: 100 },
                      { label: "Logistics Risk", value: customer.riskEngine.logisticsRisk, icon: Truck, max: 100 },
                      { label: "Customs Risk", value: customer.riskEngine.customsRisk, icon: Anchor, max: 100 },
                      { label: "Fraud Risk", value: customer.riskEngine.fraudRisk, icon: AlertTriangle, max: 100 },
                      { label: "Operational Risk", value: customer.riskEngine.operationalRisk, icon: Activity, max: 100 },
                      { label: "Country Risk", value: customer.riskEngine.countryRisk, icon: Globe, max: 100 },
                    ].map((risk) => (
                      <div key={risk.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-600 flex items-center">
                            <risk.icon className="w-3 h-3 mr-2 text-gray-500" />
                            {risk.label}
                          </span>
                          <span className={`text-xs font-bold ${
                            risk.value <= 20 ? 'text-green-600' : risk.value <= 50 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {risk.value}/100
                          </span>
                        </div>
                        <Progress 
                          value={risk.value} 
                          className={`h-2 ${
                            risk.value <= 20 ? '[&>div]:bg-green-600' : 
                            risk.value <= 50 ? '[&>div]:bg-yellow-600' : '[&>div]:bg-red-600'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Cash Exposure Meter */}
              <Card className="p-5 border-2 border-[#010150]">
                <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center">
                  <Wallet className="w-4 h-4 mr-2 text-orange-600" />
                  Cash Exposure Meter
                </h3>
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-2">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Current Horion Cash Exposed to This Customer</span>
                        <span className="text-2xl font-bold text-orange-600">${(customer.riskEngine.cashExposure / 1000).toFixed(1)}K</span>
                      </div>
                      <Progress value={customer.riskEngine.exposureUtilization} className="h-4 [&>div]:bg-orange-600" />
                      <div className="flex items-center justify-between mt-1 text-xs text-gray-600">
                        <span>$0</span>
                        <span>Max Recommended: ${(customer.riskEngine.maxRecommendedExposure / 1000).toFixed(0)}K</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <div className="p-3 bg-red-50 rounded border border-red-200">
                        <p className="text-xs text-gray-600 mb-1">In China</p>
                        <p className="text-lg font-bold text-red-600">$8.5K</p>
                        <p className="text-xs text-gray-500">Production stage</p>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                        <p className="text-xs text-gray-600 mb-1">In Transit</p>
                        <p className="text-lg font-bold text-yellow-600">$12.0K</p>
                        <p className="text-xs text-gray-500">Sea freight</p>
                      </div>
                      <div className="p-3 bg-orange-50 rounded border border-orange-200">
                        <p className="text-xs text-gray-600 mb-1">Customs</p>
                        <p className="text-lg font-bold text-orange-600">$4.0K</p>
                        <p className="text-xs text-gray-500">Clearance</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="p-4 bg-green-50 rounded border-2 border-green-200">
                      <CheckCircle className="w-6 h-6 text-green-600 mb-2" />
                      <p className="text-xs text-gray-600 mb-1">Safe Zone</p>
                      <p className="text-sm font-bold text-green-600">
                        ${((customer.riskEngine.maxRecommendedExposure - customer.riskEngine.cashExposure) / 1000).toFixed(1)}K
                      </p>
                      <p className="text-xs text-gray-600 mt-1">Available capacity</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded border border-blue-200">
                      <Info className="w-5 h-5 text-blue-600 mb-2" />
                      <p className="text-xs text-gray-700">
                        Based on payment history, order patterns, and country risk
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Risk Badges */}
              <Card className="p-5 border-2 border-gray-200">
                <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center">
                  <Tag className="w-4 h-4 mr-2 text-gray-600" />
                  Risk Classifications
                </h3>
                <div className="flex flex-wrap gap-3">
                  {customer.riskEngine.paymentRisk <= 10 && (
                    <Badge className="bg-green-100 text-green-700 border border-green-300 px-3 py-2 text-sm">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Low Payment Risk
                    </Badge>
                  )}
                  {customer.riskEngine.cashExposure > 20000 && (
                    <Badge className="bg-orange-100 text-orange-700 border border-orange-300 px-3 py-2 text-sm">
                      <Wallet className="w-4 h-4 mr-2" />
                      Cash Risk
                    </Badge>
                  )}
                  {customer.riskEngine.supplierReliability >= 90 && (
                    <Badge className="bg-blue-100 text-blue-700 border border-blue-300 px-3 py-2 text-sm">
                      <Factory className="w-4 h-4 mr-2" />
                      Reliable Supply Chain
                    </Badge>
                  )}
                  {customer.riskEngine.fraudRisk <= 5 && (
                    <Badge className="bg-green-100 text-green-700 border border-green-300 px-3 py-2 text-sm">
                      <Shield className="w-4 h-4 mr-2" />
                      No Fraud Risk
                    </Badge>
                  )}
                  {customer.riskEngine.disputeFrequency === 0 && (
                    <Badge className="bg-green-100 text-green-700 border border-green-300 px-3 py-2 text-sm">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Zero Disputes
                    </Badge>
                  )}
                </div>
              </Card>
            </TabsContent>

            {/* Placeholder for other tabs - would continue similarly */}
            <TabsContent value="supply">
              <Card className="p-8 text-center">
                <Ship className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">Supply Chain Intelligence tab content here...</p>
              </Card>
            </TabsContent>

            <TabsContent value="ai">
              <Card className="p-8 text-center">
                <Brain className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">AI Customer Brain tab content here...</p>
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-6">
              <Card className="p-6 border-2 border-[#010150]">
                <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-[#5F27CD]" />
                  Activity Timeline
                </h3>
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className="mt-1 h-2 w-2 rounded-full bg-[#5F27CD]" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#010150]">{activity.description}</p>
                        <p className="text-xs text-gray-500">
                          {activity.date} • {activity.user}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {activity.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6 border-2 border-green-200 bg-green-50">
                <h3 className="text-sm font-bold text-[#010150] mb-4 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2 text-green-600" />
                  WhatsApp Conversation
                </h3>
                <div className="space-y-3">
                  {whatsappHistory.map((message) => (
                    <div key={message.id} className="rounded-lg border border-green-200 bg-white p-3">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{message.sender}</span>
                        <span>{message.date}</span>
                      </div>
                      <p className="text-sm text-gray-700 mt-2">{message.message}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="orders">
              <Card className="p-8 text-center">
                <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">Orders & History tab content here...</p>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Modals */}
        {showSendMessageDialog && (
          <Dialog open={showSendMessageDialog} onOpenChange={setShowSendMessageDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Send WhatsApp Message</DialogTitle>
                <DialogDescription>Send a message to {customer.name}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Message</Label>
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="min-h-[150px] mt-2"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSendMessageDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    toast.success("Message sent via WhatsApp");
                    setShowSendMessageDialog(false);
                    setNewMessage("");
                  }}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </TooltipProvider>
  );
}


