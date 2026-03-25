"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContact, updateContact, deleteContact, updateLeadStatus, updateLead, exportContactsCSV } from "@/lib/actions/contact.actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search, Plus, MessageSquare, Eye, Filter, Download, Users, UserPlus, TrendingUp, X,
  Edit, Trash2, Upload, ArrowUpDown, MoreVertical, Tag, FileText, Clock,
  UserCheck, UserX, CheckCircle, XCircle, AlertCircle, Mail, Phone, Copy, Archive,
  Sparkles, Target, Activity
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard, KpiGrid } from "@/components/shared/kpi-card";
import Link from "next/link";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { copyToClipboard } from "@/lib/clipboard";

export interface Customer {
  id: string;
  ownerId?: string;
  churnRisk?: number; // 0.0–1.0 from CustomerAIProfile.predictedChurnRisk
  name: string;
  phone: string;
  email?: string;
  country: string;
  city?: string;
  whatsapp: "Active" | "Inactive";
  orders: number;
  ltv: string;
  tags: string[];
  riskScore: "Low" | "Medium" | "High";
  owner: string;
  onboardedBy: string;
  aiScore: number;
  nextAction: string;
  collaborators: string[];
  lastContact?: string;
  notes?: string;
}

export interface Lead {
  id: string;
  ownerId?: string;
  name: string;
  phone: string;
  country: string;
  product: string;
  estimatedValue: string;
  status: "New" | "Qualified" | "Quoted" | "Paid" | "Lost";
  assignedAgent: string;
  owner: string;
  onboardedBy: string;
  source: string;
  aiScore: number;
  nextAction: string;
  collaborators: string[];
  lastContact: string;
  containerType?: "LCL" | "FCL" | "AERIEN";
  originCountry?: string;
  notes?: string;
  updatedAtTs?: number; // Unix timestamp ms — used for SLA calculation
}

export interface Prospect {
  id: string;
  ownerId?: string;
  name: string;
  phone: string;
  country: string;
  inquiry: string;
  source: string;
  owner: string;
  onboardedBy: string;
  intentScore: number;
  collaborators: string[];
  status: "New" | "Contacted" | "Qualified" | "Rejected";
  notes?: string;
}

const customersData: Customer[] = [
  { id: "c1", name: "Okoye Electronics Ltd", phone: "+234 801 234 5678", email: "okoye@example.com", country: "Nigeria", city: "Lagos", whatsapp: "Active", orders: 12, ltv: "$124,500", tags: ["VIP", "Importer"], riskScore: "Low", owner: "Sarah Johnson", onboardedBy: "Awa Mbemba", aiScore: 92, nextAction: "Send Q1 bundle proposal", collaborators: ["Awa Mbemba"], lastContact: "2h ago" },
  { id: "c2", name: "Nairobi Tech Hub", phone: "+254 722 123 456", email: "info@nairobihub.com", country: "Kenya", city: "Nairobi", whatsapp: "Active", orders: 8, ltv: "$89,200", tags: ["Reseller"], riskScore: "Low", owner: "Awa Mbemba", onboardedBy: "Awa Mbemba", aiScore: 80, nextAction: "Confirm payment terms", collaborators: ["Sarah Johnson"], lastContact: "1d ago" },
  { id: "c3", name: "Accra Import Group", phone: "+233 24 123 4567", country: "Ghana", city: "Accra", whatsapp: "Active", orders: 15, ltv: "$201,300", tags: ["VIP", "Importer"], riskScore: "Medium", owner: "Sarah Johnson", onboardedBy: "Jean Kouamé", aiScore: 76, nextAction: "Review shipping ETA", collaborators: ["Jean Kouamé"], lastContact: "5h ago" },
  { id: "c4", name: "Lagos Wholesale", phone: "+234 803 987 6543", country: "Nigeria", city: "Lagos", whatsapp: "Inactive", orders: 5, ltv: "$42,800", tags: ["Reseller"], riskScore: "High", owner: "Jean Kouamé", onboardedBy: "Jean Kouamé", aiScore: 48, nextAction: "Recover payment delay", collaborators: ["Awa Mbemba"], lastContact: "2w ago" },
  { id: "c5", name: "Dar Tech Solutions", phone: "+255 754 321 098", country: "Tanzania", city: "Dar es Salaam", whatsapp: "Active", orders: 3, ltv: "$18,900", tags: ["New"], riskScore: "Low", owner: "Awa Mbemba", onboardedBy: "Awa Mbemba", aiScore: 68, nextAction: "Schedule onboarding call", collaborators: ["Sarah Johnson"], lastContact: "3d ago" },
];

const leadsData: Lead[] = [
  { id: "l1", name: "Kampala Electronics", phone: "+256 700 123 456", country: "Uganda", product: "Solar Panels", estimatedValue: "$45,000", status: "Qualified", assignedAgent: "Zelia AI", owner: "Sarah Johnson", onboardedBy: "Sarah Johnson", source: "WhatsApp", aiScore: 86, nextAction: "Send pricing breakdown", collaborators: ["Awa Mbemba"], lastContact: "2h ago" },
  { id: "l2", name: "Abidjan Trading Co", phone: "+225 07 12 34 56", country: "Côte d'Ivoire", product: "Laptops", estimatedValue: "$28,000", status: "New", assignedAgent: "Human Agent", owner: "Awa Mbemba", onboardedBy: "Awa Mbemba", source: "Referral", aiScore: 62, nextAction: "Qualify budget", collaborators: ["Sarah Johnson"], lastContact: "1d ago" },
  { id: "l3", name: "Maputo Imports", phone: "+258 82 123 4567", country: "Mozambique", product: "Smartphones", estimatedValue: "$62,000", status: "Quoted", assignedAgent: "Zelia AI", owner: "Jean Kouamé", onboardedBy: "Jean Kouamé", source: "Landing Page", aiScore: 78, nextAction: "Follow up on quote", collaborators: ["Sarah Johnson"], lastContact: "3h ago" },
  { id: "l4", name: "Kigali Tech Store", phone: "+250 788 123 456", country: "Rwanda", product: "Tablets", estimatedValue: "$15,000", status: "New", assignedAgent: "Human Agent", owner: "Sarah Johnson", onboardedBy: "Sarah Johnson", source: "WhatsApp", aiScore: 54, nextAction: "Schedule discovery call", collaborators: ["Jean Kouamé"], lastContact: "5h ago" },
  { id: "l5", name: "Lusaka Mobile Hub", phone: "+260 97 123 4567", country: "Zambia", product: "Power Banks", estimatedValue: "$22,000", status: "Paid", assignedAgent: "Zelia AI", owner: "Awa Mbemba", onboardedBy: "Awa Mbemba", source: "Event", aiScore: 90, nextAction: "Prepare onboarding kit", collaborators: ["Sarah Johnson"], lastContact: "1h ago" },
];

const prospectsData: Prospect[] = [
  { id: "p1", name: "Harare Tech Solutions", phone: "+263 77 123 4567", country: "Zimbabwe", inquiry: "Electronics wholesale", source: "WhatsApp", owner: "Sarah Johnson", onboardedBy: "Sarah Johnson", intentScore: 74, collaborators: ["Awa Mbemba"], status: "New" },
  { id: "p2", name: "Windhoek Imports", phone: "+264 81 234 5678", country: "Namibia", inquiry: "Solar equipment", source: "Website", owner: "Awa Mbemba", onboardedBy: "Awa Mbemba", intentScore: 58, collaborators: ["Sarah Johnson"], status: "Contacted" },
  { id: "p3", name: "Gaborone Trading", phone: "+267 72 345 678", country: "Botswana", inquiry: "Office supplies", source: "Referral", owner: "Jean Kouamé", onboardedBy: "Jean Kouamé", intentScore: 41, collaborators: ["Awa Mbemba"], status: "New" },
];

export interface CrmDashboardProps {
  initialCustomers?: Customer[];
  initialLeads?: Lead[];
  initialProspects?: Prospect[];
  demoMode?: boolean;
  currentUserName?: string;
  currentUserId?: string;
}

const whatsappTemplates = [
  { id: 1, name: "First Contact", message: "Hello {name}, welcome to Horion! How can we help you today?" },
  { id: 2, name: "Follow Up", message: "Hi {name}, just following up on our last conversation. Are you still interested in {product}?" },
  { id: 3, name: "Quote Ready", message: "Hello {name}, your quote for {product} is ready. Total: {amount}. Would you like to proceed?" },
  { id: 4, name: "Payment Reminder", message: "Hi {name}, this is a friendly reminder about the pending payment of {amount} for order {orderId}." },
];

// Map display lead status → DB enum
const mapLeadStatusToDB = (status: Lead["status"]): string => {
  const map: Record<Lead["status"], string> = {
    New: "NEW",
    Qualified: "QUALIFIED",
    Quoted: "QUOTED",
    Paid: "WON",
    Lost: "LOST",
  };
  return map[status] || "NEW";
};

// SLA deadlines in days per lead status (time allowed in that status before next action)
const LEAD_SLA_DAYS: Record<Lead["status"], number> = {
  New: 1,
  Qualified: 2,
  Quoted: 5,
  Paid: 3,
  Lost: 0,
};

function LeadSLABadge({ updatedAtTs, status }: { updatedAtTs?: number; status: Lead["status"] }) {
  const slaDays = LEAD_SLA_DAYS[status] ?? 0;
  if (!updatedAtTs || slaDays === 0) return null;
  const ageDays = (Date.now() - updatedAtTs) / 86_400_000;
  const ratio = ageDays / slaDays;
  if (ratio >= 1) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
        <Clock className="h-2.5 w-2.5" />
        SLA {Math.floor(ageDays - slaDays)}j dépassé
      </span>
    );
  }
  if (ratio >= 0.75) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
        <Clock className="h-2.5 w-2.5" />
        SLA J-{Math.ceil(slaDays - ageDays)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
      <CheckCircle className="h-2.5 w-2.5" />
      Dans SLA
    </span>
  );
}

// Churn risk label + color from 0.0–1.0 value
function ChurnRiskBadge({ churnRisk }: { churnRisk?: number }) {
  if (churnRisk == null) return null;
  const pct = Math.round(churnRisk * 100);
  if (pct >= 60) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
        Churn {pct}%
      </span>
    );
  }
  if (pct >= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
        Churn {pct}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
      Stable {pct}%
    </span>
  );
}

export function CrmDashboard({ initialCustomers = customersData, initialLeads = leadsData, initialProspects = prospectsData, demoMode = false, currentUserName = "Sarah Johnson", currentUserId = "" }: CrmDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [prospects, setProspects] = useState<Prospect[]>(initialProspects);

  // Sync local state when server refreshes props
  useEffect(() => { setCustomers(initialCustomers); }, [initialCustomers]);
  useEffect(() => { setLeads(initialLeads); }, [initialLeads]);
  useEffect(() => { setProspects(initialProspects); }, [initialProspects]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  
  // Dialogs & Sheets
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);
  const [showEditCustomerDialog, setShowEditCustomerDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAddTagDialog, setShowAddTagDialog] = useState(false);
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [showWhatsAppTemplateDialog, setShowWhatsAppTemplateDialog] = useState(false);
  const [showLeadDetailsDialog, setShowLeadDetailsDialog] = useState(false);
  const [showConvertLeadDialog, setShowConvertLeadDialog] = useState(false);
  const [showQualifyProspectDialog, setShowQualifyProspectDialog] = useState(false);
  const [showRejectProspectDialog, setShowRejectProspectDialog] = useState(false);
  
  // Selected items
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  
  // Filters
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedRiskScore, setSelectedRiskScore] = useState("all");
  const [selectedWhatsappStatus, setSelectedWhatsappStatus] = useState("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedOwner, setSelectedOwner] = useState("all");
  const [portfolioScope, setPortfolioScope] = useState<"all" | "mine">("all");
  
  // Sorting
  const [sortBy, setSortBy] = useState<keyof Customer | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  // Forms
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    country: "",
    city: "",
    notes: "",
    owner: currentUserName,
    collaborators: "",
  });
  
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [newTag, setNewTag] = useState("");
  const [newNote, setNewNote] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [leadStatus, setLeadStatus] = useState<Lead["status"]>("New");
  const [assignedAgent, setAssignedAgent] = useState("Zelia AI");
  const [leadOwner, setLeadOwner] = useState(currentUserName);
  const [leadCollaborators, setLeadCollaborators] = useState("");
  const [qualifyEstimatedValue, setQualifyEstimatedValue] = useState("");
  const [qualifyAgent, setQualifyAgent] = useState("Zelia AI");
  const [qualifyStatus, setQualifyStatus] = useState<Lead["status"]>("New");
  const [qualifyNotes, setQualifyNotes] = useState("");
  const [leadNextAction, setLeadNextAction] = useState("");

  const createId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const openLeadDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setLeadNotes(lead.notes || "");
    setLeadStatus(lead.status);
    setAssignedAgent(lead.assignedAgent);
    setLeadOwner(lead.owner);
    setLeadCollaborators((lead.collaborators || []).join(", "));
    setLeadNextAction(lead.nextAction || "");
    setShowLeadDetailsDialog(true);
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Calculate stats
  const totalCustomers = customers.length;
  const visibleLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesPortfolio =
        portfolioScope === "all" ||
        (currentUserId ? lead.ownerId === currentUserId : lead.owner === currentUserName) ||
        lead.collaborators.includes(currentUserName);
      const matchesOwner = selectedOwner === "all" || lead.owner === selectedOwner;
      return matchesPortfolio && matchesOwner;
    });
  }, [leads, portfolioScope, currentUserId, currentUserName, selectedOwner]);
  const visibleProspects = useMemo(() => {
    return prospects.filter((prospect) => {
      const matchesPortfolio =
        portfolioScope === "all" ||
        (currentUserId ? prospect.ownerId === currentUserId : prospect.owner === currentUserName) ||
        prospect.collaborators.includes(currentUserName);
      const matchesOwner = selectedOwner === "all" || prospect.owner === selectedOwner;
      return matchesPortfolio && matchesOwner;
    });
  }, [prospects, portfolioScope, currentUserId, currentUserName, selectedOwner]);

  const activeLeads = useMemo(
    () => visibleLeads.filter(l => l.status !== "Lost" && l.status !== "Paid").length,
    [visibleLeads]
  );
  const whatsappConnected = customers.filter(c => c.whatsapp === "Active").length;
  const totalLTV = useMemo(() => {
    return customers.reduce((sum, c) => {
      const value = Number(String(c.ltv).replace(/[^0-9.-]/g, ""));
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
  }, [customers]);
  const atRiskCustomers = useMemo(() => customers.filter(c => c.riskScore === "High").length, [customers]);
  const highIntentLeads = useMemo(() => leads.filter(l => l.aiScore >= 75).length, [leads]);
  const nextActions = useMemo(() => {
    const customerActions = customers.filter(c => c.nextAction && c.nextAction.trim().length > 0).length;
    const leadActions = leads.filter(l => l.nextAction && l.nextAction.trim().length > 0).length;
    return customerActions + leadActions;
  }, [customers, leads]);
  const avgAiScore = useMemo(() => {
    const scores = [...customers.map(c => c.aiScore), ...leads.map(l => l.aiScore)];
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  }, [customers, leads]);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch = 
        customer.name.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        customer.phone.includes(deferredSearch) ||
        customer.country.toLowerCase().includes(deferredSearch.toLowerCase()) ||
        (customer.email && customer.email.toLowerCase().includes(deferredSearch.toLowerCase()));
      
      const matchesCountry = selectedCountry === "all" || customer.country === selectedCountry;
      const matchesRisk = selectedRiskScore === "all" || customer.riskScore === selectedRiskScore;
      const matchesWhatsapp = selectedWhatsappStatus === "all" || customer.whatsapp === selectedWhatsappStatus;
      const matchesTags = selectedTags.length === 0 || selectedTags.some(tag => customer.tags.includes(tag));
      const matchesOwner = selectedOwner === "all" || customer.owner === selectedOwner;
      const matchesPortfolio =
        portfolioScope === "all" ||
        (currentUserId ? customer.ownerId === currentUserId : customer.owner === currentUserName) ||
        customer.collaborators.includes(currentUserName);

      return matchesSearch && matchesCountry && matchesRisk && matchesWhatsapp && matchesTags && matchesOwner && matchesPortfolio;
    });
  }, [customers, deferredSearch, selectedCountry, selectedRiskScore, selectedWhatsappStatus, selectedTags, selectedOwner, portfolioScope, currentUserName]);

  const priorityActions = useMemo(() => {
    const riskWeight: Record<Customer["riskScore"], number> = {
      Low: 20,
      Medium: 50,
      High: 80,
    };
    const customerActions = filteredCustomers.map((customer) => ({
      id: customer.id,
      type: "Customer",
      name: customer.name,
      owner: customer.owner,
      score: customer.aiScore + riskWeight[customer.riskScore],
      nextAction: customer.nextAction,
      tag: customer.riskScore === "High" ? "Risk" : "AI",
    }));
    const leadActions = visibleLeads.map((lead) => ({
      id: lead.id,
      type: "Lead",
      name: lead.name,
      owner: lead.owner,
      score: lead.aiScore + (lead.status === "Quoted" ? 15 : 0),
      nextAction: lead.nextAction,
      tag: lead.status,
    }));
    return [...customerActions, ...leadActions]
      .filter((item) => item.nextAction)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [filteredCustomers, visibleLeads]);

  // Sort customers
  const sortedCustomers = useMemo(() => {
    if (!sortBy) return filteredCustomers;
    return [...filteredCustomers].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [filteredCustomers, sortBy, sortOrder]);

  // Paginate
  const totalPages = Math.ceil(sortedCustomers.length / itemsPerPage);
  const paginatedCustomers = useMemo(() => {
    return sortedCustomers.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [sortedCustomers, currentPage, itemsPerPage]);

  // Validate phone number
  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  // Validate email
  const validateEmail = (email: string): boolean => {
    if (!email) return true; // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Add Customer
  const handleAddCustomer = () => {
    if (!newCustomer.name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!newCustomer.phone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    if (!validatePhone(newCustomer.phone)) {
      toast.error("Invalid phone number format");
      return;
    }
    if (newCustomer.email && !validateEmail(newCustomer.email)) {
      toast.error("Invalid email format");
      return;
    }
    if (!newCustomer.country) {
      toast.error("Country is required");
      return;
    }

    // Check for duplicates
    const isDuplicate = customers.some(c => 
      c.phone.replace(/\s/g, '') === newCustomer.phone.replace(/\s/g, '')
    );
    
    if (isDuplicate) {
      toast.error("A customer with this phone number already exists");
      return;
    }

    const tempId = createId();
    const customer: Customer = {
      id: tempId,
      ownerId: currentUserId || undefined,
      name: newCustomer.name,
      phone: newCustomer.phone,
      email: newCustomer.email || undefined,
      country: newCustomer.country,
      city: newCustomer.city || undefined,
      whatsapp: "Active",
      orders: 0,
      ltv: "—",
      tags: ["New"],
      riskScore: "Low",
      owner: newCustomer.owner || currentUserName,
      onboardedBy: currentUserName,
      aiScore: 62,
      nextAction: "Schedule onboarding call",
      collaborators: newCustomer.collaborators
        ? newCustomer.collaborators.split(",").map((value) => value.trim()).filter(Boolean)
        : [],
      lastContact: "Just now",
      notes: newCustomer.notes || undefined,
    };

    // Optimistic update
    setCustomers(prev => [customer, ...prev]);
    setShowAddCustomerDialog(false);
    setNewCustomer({ name: "", phone: "", email: "", country: "", city: "", notes: "", owner: currentUserName, collaborators: "" });

    if (!demoMode) {
      startTransition(async () => {
        const result = await createContact({
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          country: customer.country,
          city: customer.city,
          notes: customer.notes,
          type: "CLIENT",
          ownerId: currentUserId || undefined,
        });
        if (result.error) {
          setCustomers(prev => prev.filter(c => c.id !== tempId));
          toast.error(result.error);
        } else {
          toast.success(`${customer.name} ajouté avec succès !`);
          router.refresh();
        }
      });
    } else {
      toast.success(`${customer.name} added successfully!`);
    }
  };

  // Edit Customer
  const handleEditCustomer = () => {
    if (!editingCustomer) return;

    if (!editingCustomer.name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!validatePhone(editingCustomer.phone)) {
      toast.error("Invalid phone number format");
      return;
    }
    if (editingCustomer.email && !validateEmail(editingCustomer.email)) {
      toast.error("Invalid email format");
      return;
    }

    // Optimistic update
    setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? editingCustomer : c));
    setShowEditCustomerDialog(false);
    const savedCustomer = editingCustomer;
    setEditingCustomer(null);

    if (!demoMode) {
      startTransition(async () => {
        const result = await updateContact(savedCustomer.id, {
          name: savedCustomer.name,
          phone: savedCustomer.phone,
          email: savedCustomer.email,
          country: savedCustomer.country,
          city: savedCustomer.city,
          notes: savedCustomer.notes,
          tags: savedCustomer.tags,
        });
        if (result.error) {
          toast.error(result.error);
          router.refresh(); // Revert to server state
        } else {
          toast.success("Contact mis à jour !");
          router.refresh();
        }
      });
    } else {
      toast.success("Customer updated successfully!");
    }
  };

  // Delete Customer
  const handleDeleteCustomer = () => {
    if (customerToDelete) {
      const customer = customers.find(c => c.id === customerToDelete);
      const deletedId = customerToDelete;

      // Optimistic update
      setCustomers(prev => prev.filter(c => c.id !== deletedId));
      setShowDeleteDialog(false);
      setCustomerToDelete(null);

      if (!demoMode) {
        startTransition(async () => {
          const result = await deleteContact(deletedId);
          if (result.error) {
            toast.error(result.error);
            router.refresh(); // Revert to server state
          } else {
            toast.success(`${customer?.name} supprimé`);
            router.refresh();
          }
        });
      } else {
        toast.success(`${customer?.name} deleted successfully`);
      }
    }
  };

  // Bulk Delete
  const handleBulkDelete = () => {
    if (selectedCustomers.length === 0) {
      toast.error("No customers selected");
      return;
    }
    setCustomers(customers.filter(c => !selectedCustomers.includes(c.id)));
    setSelectedCustomers([]);
    toast.success(`${selectedCustomers.length} customer(s) deleted`);
  };

  // Add Tag to Customer
  const handleAddTag = () => {
    if (!selectedCustomer || !newTag.trim()) {
      toast.error("Tag name is required");
      return;
    }

    const updated = customers.map(c => 
      c.id === selectedCustomer.id 
        ? { ...c, tags: [...new Set([...c.tags, newTag.trim()])] }
        : c
    );
    
    setCustomers(updated);
    setNewTag("");
    setShowAddTagDialog(false);
    toast.success("Tag added successfully!");
  };

  // Remove Tag from Customer
  const handleRemoveTag = (customerId: string, tag: string) => {
    setCustomers(customers.map(c => 
      c.id === customerId 
        ? { ...c, tags: c.tags.filter(t => t !== tag) }
        : c
    ));
    toast.success("Tag removed");
  };

  // Add Note
  const handleAddNote = () => {
    if (!selectedCustomer || !newNote.trim()) {
      toast.error("Note content is required");
      return;
    }

    const updated = customers.map(c => 
      c.id === selectedCustomer.id 
        ? { ...c, notes: c.notes ? `${c.notes}\n\n[${new Date().toLocaleString()}]\n${newNote}` : `[${new Date().toLocaleString()}]\n${newNote}` }
        : c
    );
    
    setCustomers(updated);
    setNewNote("");
    setShowAddNoteDialog(false);
    toast.success("Note added successfully!");
  };

  // Export CSV — server action in prod, local fallback in demo
  const handleExport = () => {
    if (!demoMode) {
      startTransition(async () => {
        toast.info("Préparation de l'export...");
        const result = await exportContactsCSV();
        if (result.error) {
          toast.error(result.error);
          return;
        }
        const blob = new Blob([result.data!], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `horion-contacts-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Export réussi !");
      });
      return;
    }
    // Demo mode: local CSV
    const csvContent = [
      ["Name", "Phone", "Email", "Country", "City", "WhatsApp", "Orders", "LTV", "Tags", "Risk Score"],
      ...sortedCustomers.map(c => [
        c.name, c.phone, c.email || "", c.country, c.city || "",
        c.whatsapp, c.orders, c.ltv, c.tags.join(";"), c.riskScore,
      ])
    ].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `horion-customers-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${sortedCustomers.length} contact(s) exporté(s) !`);
  };

  // WhatsApp Contact
  const handleWhatsAppContact = (phone: string, name: string, templateId?: number) => {
    let message = `Hello ${name}, this is Horion Admin.`;
    
    if (templateId) {
      const template = whatsappTemplates.find(t => t.id === templateId);
      if (template) {
        message = template.message.replace("{name}", name);
      }
    }

    const whatsappUrl = `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    toast.success(`Opening WhatsApp chat with ${name}`);
  };

  // Call
  const handleCall = (phone: string, name: string) => {
    window.location.href = `tel:${phone}`;
    toast.success(`Calling ${name}...`);
  };

  // Email
  const handleEmail = (email: string, name: string) => {
    if (!email) {
      toast.error("No email address available");
      return;
    }
    window.location.href = `mailto:${email}`;
    toast.success(`Opening email to ${name}...`);
  };

  // Copy to Clipboard
  const handleCopy = async (text: string, label: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      toast.success(`${label} copied to clipboard`);
    } else {
      toast.error(`Failed to copy ${label}. Please try again.`);
    }
  };

  // Toggle WhatsApp Status
  const handleToggleWhatsApp = (customerId: string) => {
    setCustomers(customers.map(c => 
      c.id === customerId 
        ? { ...c, whatsapp: c.whatsapp === "Active" ? "Inactive" : "Active" }
        : c
    ));
    toast.success("WhatsApp status updated");
  };

  // Convert Lead to Customer
  const handleConvertLead = () => {
    if (!selectedLead) return;

    const newCustomer: Customer = {
      id: createId(),
      name: selectedLead.name,
      phone: selectedLead.phone,
      country: selectedLead.country,
      whatsapp: "Active",
      orders: 0,
      ltv: "$0",
      tags: ["Converted Lead"],
      riskScore: "Low",
      owner: currentUserName,
      onboardedBy: selectedLead.onboardedBy,
      aiScore: selectedLead.aiScore,
      nextAction: "Send onboarding kit",
      collaborators: Array.from(
        new Set(
          [selectedLead.owner, ...(selectedLead.collaborators || [])].filter(
            (name) => name && name !== currentUserName
          )
        )
      ),
      lastContact: "Just now",
    };

    setCustomers([newCustomer, ...customers]);
    setLeads(leads.filter(l => l.id !== selectedLead.id));
    setShowConvertLeadDialog(false);
    setSelectedLead(null);
    toast.success(`${newCustomer.name} converted to customer!`);
  };

  // Update Lead Status
  const handleUpdateLeadStatus = (leadId: string, status: Lead["status"]) => {
    const nextActionByStatus: Record<Lead["status"], string> = {
      New: "Schedule discovery call",
      Qualified: "Send tailored proposal",
      Quoted: "Relancer devis",
      Paid: "Prepare onboarding kit",
      Lost: "Capture loss reason",
    };

    // Optimistic update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status, nextAction: nextActionByStatus[status] || l.nextAction } : l));

    if (!demoMode) {
      startTransition(async () => {
        const result = await updateLeadStatus(leadId, mapLeadStatusToDB(status));
        if (result.error) {
          toast.error(result.error);
          router.refresh();
        } else {
          toast.success("Statut du lead mis à jour");
          router.refresh();
        }
      });
    } else {
      toast.success("Lead status updated");
    }
  };

  // Assign Lead to Agent
  const handleAssignLead = (leadId: string, agent: string) => {
    setLeads(leads.map(l => l.id === leadId ? { ...l, assignedAgent: agent } : l));
    toast.success(`Lead assigned to ${agent}`);
  };

  const handleSaveLeadDetails = () => {
    if (!selectedLead) return;
    const updatedLead: Lead = {
      ...selectedLead,
      status: leadStatus || selectedLead.status,
      assignedAgent: assignedAgent || selectedLead.assignedAgent,
      owner: leadOwner || selectedLead.owner,
      collaborators: leadCollaborators
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      notes: leadNotes.trim() || undefined,
      nextAction: leadNextAction.trim() || selectedLead.nextAction,
    };

    // Optimistic update
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? updatedLead : l));
    setSelectedLead(updatedLead);
    setShowLeadDetailsDialog(false);

    if (!demoMode) {
      const leadId = selectedLead.id;
      startTransition(async () => {
        const result = await updateLead(leadId, {
          status: mapLeadStatusToDB(updatedLead.status),
          notes: updatedLead.notes,
          nextAction: updatedLead.nextAction,
        });
        if (result.error) {
          toast.error(result.error);
          router.refresh();
        } else {
          toast.success("Lead mis à jour !");
          router.refresh();
        }
      });
    } else {
      toast.success("Lead updated successfully!");
    }
  };

  const handleContactProspect = (prospect: Prospect) => {
    handleWhatsAppContact(prospect.phone, prospect.name);
    if (prospect.status === "New") {
      setProspects(prospects.map(p => 
        p.id === prospect.id ? { ...p, status: "Contacted" } : p
      ));
      toast.success("Prospect marked as contacted");
    }
  };

  // Qualify Prospect
  const handleQualifyProspect = () => {
    if (!selectedProspect) return;

    const newLead: Lead = {
      id: createId(),
      name: selectedProspect.name,
      phone: selectedProspect.phone,
      country: selectedProspect.country,
      product: selectedProspect.inquiry,
      estimatedValue: qualifyEstimatedValue.trim() || "$0",
      status: qualifyStatus,
      assignedAgent: qualifyAgent,
      owner: currentUserName,
      onboardedBy: selectedProspect.onboardedBy,
      source: selectedProspect.source,
      aiScore: selectedProspect.intentScore,
      nextAction: "Send intro message",
      collaborators: Array.from(
        new Set(
          [selectedProspect.owner, ...(selectedProspect.collaborators || [])].filter(
            (name) => name && name !== currentUserName
          )
        )
      ),
      lastContact: "Just now",
      notes: qualifyNotes.trim() || undefined,
    };

    setLeads([newLead, ...leads]);
    setProspects(prospects.map(p => 
      p.id === selectedProspect.id ? { ...p, status: "Qualified" } : p
    ));
    setShowQualifyProspectDialog(false);
    setSelectedProspect(null);
    setQualifyEstimatedValue("");
    setQualifyAgent("Zelia AI");
    setQualifyStatus("New");
    setQualifyNotes("");
    toast.success(`${newLead.name} qualified as lead!`);
  };

  // Reject Prospect
  const handleRejectProspect = () => {
    if (!selectedProspect || !rejectionReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }

    setProspects(prospects.map(p => 
      p.id === selectedProspect.id ? { ...p, status: "Rejected", notes: rejectionReason } : p
    ));
    setShowRejectProspectDialog(false);
    setSelectedProspect(null);
    setRejectionReason("");
    toast.success("Prospect rejected");
  };

  // Sort handler
  const handleSort = (column: keyof Customer) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSelectedCountry("all");
    setSelectedRiskScore("all");
    setSelectedWhatsappStatus("all");
    setSelectedTags([]);
    setSelectedOwner("all");
    setSearchQuery("");
    toast.success("All filters cleared");
  };

  // Select/deselect all
  const handleSelectAll = () => {
    if (selectedCustomers.length === paginatedCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(paginatedCustomers.map(c => c.id));
    }
  };

  const allTags = useMemo(() => Array.from(new Set(customers.flatMap(c => c.tags))), [customers]);
  const countries = useMemo(() => Array.from(new Set(customers.map(c => c.country))), [customers]);
  const ownerOptions = useMemo(() => {
    return Array.from(new Set([
      ...customers.map(c => c.owner),
      ...leads.map(l => l.owner),
      ...prospects.map(p => p.owner),
      currentUserName,
    ].filter(Boolean)));
  }, [customers, leads, prospects, currentUserName]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM — Relation Clients"
        description="Pilotage clients, leads et prospects"
      >
        {demoMode && <Badge variant="secondary">DEMO</Badge>}
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowImportDialog(true)}>
          <Upload className="w-4 h-4" />
          Importer
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="w-4 h-4" />
          Exporter
        </Button>
        <Button size="sm" className="gap-2" onClick={() => setShowAddCustomerDialog(true)}>
          <Plus className="w-4 h-4" />
          Nouveau client
        </Button>
      </PageHeader>

      <KpiGrid cols={4}>
        <KpiCard
          label="Clients totaux"
          value={totalCustomers}
          sub={filteredCustomers.length + " filtrés"}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Leads actifs"
          value={activeLeads}
          sub={"+" + visibleProspects.filter(p => p.status === "New").length + " nouveaux"}
          icon={<UserPlus className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="WhatsApp actif"
          value={whatsappConnected}
          sub={(totalCustomers > 0 ? Math.round((whatsappConnected / totalCustomers) * 100) : 0) + "% des clients"}
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Valeur client (LTV)"
          value={"$" + (totalLTV / 1_000_000).toFixed(1) + "M"}
          sub="total portefeuille"
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          variant="success"
        />
      </KpiGrid>

      <KpiGrid cols={4}>
        <KpiCard
          label="Score IA portefeuille"
          value={avgAiScore + "/100"}
          sub="Santé globale"
          icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Leads forte intention"
          value={highIntentLeads}
          sub="Score IA ≥ 75"
          icon={<Target className="h-4 w-4 text-muted-foreground" />}
          variant="success"
        />
        <KpiCard
          label="Clients à risque"
          value={atRiskCustomers}
          sub="Rétention à lancer"
          icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
          variant={atRiskCustomers > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Actions à faire"
          value={nextActions}
          sub="Relances en attente"
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          variant={nextActions > 0 ? "warning" : "default"}
        />
      </KpiGrid>

      <Card className="mb-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold">Priority Actions</h3>
              <p className="text-xs text-muted-foreground">AI-ranked next steps across your portfolio</p>
            </div>
            <Badge className="bg-primary text-primary-foreground">{priorityActions.length} actions</Badge>
          </div>
          {priorityActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No priority actions available.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {priorityActions.map((action) => (
                <div key={`${action.type}-${action.id}`} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{action.name}</p>
                      <p className="text-xs text-muted-foreground">{action.type} · Owner: {action.owner}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {action.tag}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{action.nextAction}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Tabs defaultValue="customers" className="space-y-6">
          <TabsList>
            <TabsTrigger value="customers">Clients ({totalCustomers})</TabsTrigger>
            <TabsTrigger value="leads">Leads ({visibleLeads.length})</TabsTrigger>
            <TabsTrigger value="prospects">Prospects ({visibleProspects.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="customers" className="space-y-4">
            {/* Search and Actions Bar */}
            <Card className="p-4 border-border">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by name, phone, email, country..." 
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={portfolioScope === "mine" ? "default" : "outline"}
                    className={portfolioScope === "mine" ? "bg-primary text-primary-foreground" : ""}
                    onClick={() => setPortfolioScope("mine")}
                  >
                    Mon portefeuille
                  </Button>
                  <Button
                    size="sm"
                    variant={portfolioScope === "all" ? "default" : "outline"}
                    className={portfolioScope === "all" ? "bg-primary text-primary-foreground" : ""}
                    onClick={() => setPortfolioScope("all")}
                  >
                    Équipe
                  </Button>
                  <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                    <SelectTrigger className="w-44 h-9">
                      <SelectValue placeholder="Owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les owners</SelectItem>
                      {ownerOptions.map((owner) => (
                        <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    className="gap-2"
                    onClick={() => setShowFiltersSheet(true)}
                  >
                    <Filter className="w-4 h-4" />
                    Filtres
                    {(selectedCountry !== "all" || selectedRiskScore !== "all" || selectedWhatsappStatus !== "all" || selectedTags.length > 0 || selectedOwner !== "all") && (
                      <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Active</Badge>
                    )}
                  </Button>
                  {selectedCustomers.length > 0 && (
                    <Button 
                      variant="destructive" 
                      className="gap-2"
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete ({selectedCustomers.length})
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Customers Table */}
            <Card className="border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={selectedCustomers.length === paginatedCustomers.length && paginatedCustomers.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                      <div className="flex items-center gap-2">
                        Nom
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("country")}>
                      <div className="flex items-center gap-2">
                        Pays
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("orders")}>
                      <div className="flex items-center gap-2">
                        Commandes
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("ltv")}>
                      <div className="flex items-center gap-2">
                        LTV
                        <ArrowUpDown className="w-4 h-4" />
                      </div>
                    </TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Score IA</TableHead>
                    <TableHead>Prochaine action</TableHead>
                    <TableHead>Risque</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                        Aucun client ne correspond Ã  vos filtres
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCustomers.map((customer) => {
                      const rowClass =
                        customer.riskScore === "High"
                          ? "bg-red-50/40 hover:bg-red-50/60"
                          : customer.riskScore === "Medium"
                          ? "bg-amber-50/30 hover:bg-amber-50/50"
                          : "hover:bg-gray-50";
                      return (
                      <TableRow key={customer.id} className={rowClass}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedCustomers.includes(customer.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedCustomers([...selectedCustomers, customer.id]);
                              } else {
                                setSelectedCustomers(selectedCustomers.filter(id => id !== customer.id));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            {customer.city && <p className="text-xs text-muted-foreground">{customer.city}</p>}
                            <p className="text-xs text-muted-foreground mt-1">
                              Owner: <span className="text-muted-foreground">{customer.owner}</span> · Onboarded:{" "}
                              <span className="text-muted-foreground">{customer.onboardedBy}</span>
                            </p>
                            {customer.collaborators.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {customer.collaborators.slice(0, 3).map((collaborator) => (
                                  <Badge key={collaborator} variant="outline" className="text-[10px]">
                                    {collaborator}
                                  </Badge>
                                ))}
                                {customer.collaborators.length > 3 && (
                                  <Badge variant="outline" className="text-[10px]">
                                    +{customer.collaborators.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground">{customer.phone}</span>
                              <button onClick={() => handleCopy(customer.phone, "Phone")}>
                                <Copy className="w-3 h-3 text-muted-foreground hover:text-muted-foreground" />
                              </button>
                            </div>
                            {customer.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="w-3 h-3 text-muted-foreground" />
                                <span className="text-muted-foreground">{customer.email}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{customer.country}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary" className={customer.whatsapp === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-muted text-muted-foreground"}
                            onClick={() => handleToggleWhatsApp(customer.id)}
                          >
                            {customer.whatsapp}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{customer.orders}</TableCell>
                        <TableCell className="font-medium text-green-600">{customer.ltv}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {customer.tags.map((tag) => (
                              <Badge 
                                key={tag} 
                                variant="outline" 
                                className="text-xs cursor-pointer hover:bg-red-50"
                                onClick={() => handleRemoveTag(customer.id, tag)}
                              >
                                {tag} <X className="w-2 h-2 ml-1" />
                              </Badge>
                            ))}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-5 px-1"
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setShowAddTagDialog(true);
                              }}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              customer.aiScore >= 80
                                ? "bg-green-100 text-green-700 border border-green-200"
                                : customer.aiScore >= 60
                                  ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
                                  : "bg-red-100 text-red-700 border border-red-200"
                            }
                          >
                            {customer.aiScore}/100
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {customer.nextAction ? (
                            <Badge variant="outline" className="text-[10px]">
                              {customer.nextAction}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">Aucune</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge className={
                              customer.riskScore === "Low" ? "bg-green-100 text-green-700" :
                              customer.riskScore === "Medium" ? "bg-yellow-100 text-yellow-700" :
                              "bg-red-100 text-red-700"
                            }>
                              {customer.riskScore}
                            </Badge>
                            <ChurnRiskBadge churnRisk={customer.churnRisk} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link href={demoMode ? "/demo/customer-profile" : `/contacts/${customer.id}`} className="flex items-center gap-2">
                                  <Eye className="w-4 h-4" />
                                  View Profile
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setEditingCustomer(customer);
                                setShowEditCustomerDialog(true);
                              }}>
                                <Edit className="w-4 h-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleWhatsAppContact(customer.phone, customer.name)}>
                                <MessageSquare className="w-4 h-4" />
                                WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCall(customer.phone, customer.name)}>
                                <Phone className="w-4 h-4" />
                                Call
                              </DropdownMenuItem>
                              {customer.email && (
                                <DropdownMenuItem onClick={() => handleEmail(customer.email!, customer.name)}>
                                  <Mail className="w-4 h-4" />
                                  Email
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                setSelectedCustomer(customer);
                                setShowAddNoteDialog(true);
                              }}>
                                <FileText className="w-4 h-4" />
                                Add Note
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedCustomer(customer);
                                setShowAddTagDialog(true);
                              }}>
                                <Tag className="w-4 h-4" />
                                Add Tag
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => {
                                  setCustomerToDelete(customer.id);
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )})
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedCustomers.length)} of {sortedCustomers.length} customers
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      Previous
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button 
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className={currentPage === page ? "bg-primary" : ""}
                      >
                        {page}
                      </Button>
                    ))}
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="leads" className="space-y-4">
            <Card className="border-border">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">Active Leads</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Qualified sales opportunities</p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{visibleLeads.length}</Badge>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {visibleLeads.map((lead) => (
                  <div key={lead.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{lead.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{lead.country} • {lead.phone}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Owner: <span className="text-muted-foreground">{lead.owner}</span> · Onboarded:{" "}
                          <span className="text-muted-foreground">{lead.onboardedBy}</span>
                        </p>
                        {lead.collaborators.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {lead.collaborators.slice(0, 3).map((collaborator) => (
                              <Badge key={collaborator} variant="outline" className="text-[10px]">
                                {collaborator}
                              </Badge>
                            ))}
                            {lead.collaborators.length > 3 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{lead.collaborators.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <Select value={lead.status} onValueChange={(value) => handleUpdateLeadStatus(lead.id, value as Lead["status"])}>
                        <SelectTrigger className="w-32 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="New">New</SelectItem>
                          <SelectItem value="Qualified">Qualified</SelectItem>
                          <SelectItem value="Quoted">Quoted</SelectItem>
                          <SelectItem value="Paid">Paid</SelectItem>
                          <SelectItem value="Lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-3">
                      <div>
                        <p className="text-muted-foreground">Product: <span className="font-medium text-foreground">{lead.product}</span></p>
                        <p className="text-muted-foreground mt-1">Estimated: <span className="font-medium text-green-600">{lead.estimatedValue}</span></p>
                        <p className="text-muted-foreground mt-1">
                          Source: <span className="font-medium text-foreground">{lead.source}</span> · AI Score:{" "}
                          <span className="font-semibold text-violet-600 dark:text-violet-400">{lead.aiScore}/100</span>
                        </p>
                        {(lead.containerType || lead.originCountry) && (
                          <p className="text-muted-foreground mt-1">
                            {lead.containerType && <span className="font-medium text-foreground mr-2">{lead.containerType}</span>}
                            {lead.originCountry && <span className="text-muted-foreground">Origine: {lead.originCountry}</span>}
                          </p>
                        )}
                        <p className="text-muted-foreground mt-1">
                          Next action: <span className="font-medium text-foreground">{lead.nextAction}</span>
                        </p>
                        <div className="mt-1.5 flex gap-1.5 flex-wrap">
                          <LeadSLABadge updatedAtTs={lead.updatedAtTs} status={lead.status} />
                        </div>
                      </div>
                      <div className="text-right">
                        <Select value={lead.assignedAgent} onValueChange={(value) => handleAssignLead(lead.id, value)}>
                          <SelectTrigger className="w-32 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Zelia AI">Zelia AI</SelectItem>
                            <SelectItem value="Human Agent">Human Agent</SelectItem>
                            <SelectItem value="Sales Manager">Sales Manager</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">{lead.lastContact}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 gap-2"
                        onClick={() => handleWhatsAppContact(lead.phone, lead.name)}
                      >
                        <MessageSquare className="w-3 h-3" />
                        Contact
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 gap-2"
                        onClick={() => {
                          openLeadDetails(lead);
                        }}
                      >
                        <Eye className="w-3 h-3" />
                        Details
                      </Button>
                      <Button 
                        size="sm" 
                        className="flex-1 gap-2 bg-primary hover:bg-primary/90"
                        onClick={() => {
                          setSelectedLead(lead);
                          setShowConvertLeadDialog(true);
                        }}
                      >
                        <UserCheck className="w-3 h-3" />
                        Convert
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="prospects" className="space-y-4">
            <Card className="border-border">
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">New Prospects</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Unqualified inquiries</p>
                  </div>
                  <Badge variant="outline">{visibleProspects.length}</Badge>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {visibleProspects.map((prospect) => (
                  <div key={prospect.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-foreground">{prospect.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{prospect.country} • {prospect.phone}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Owner: <span className="text-muted-foreground">{prospect.owner}</span> · Onboarded:{" "}
                          <span className="text-muted-foreground">{prospect.onboardedBy}</span>
                        </p>
                        {prospect.collaborators.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {prospect.collaborators.slice(0, 3).map((collaborator) => (
                              <Badge key={collaborator} variant="outline" className="text-[10px]">
                                {collaborator}
                              </Badge>
                            ))}
                            {prospect.collaborators.length > 3 && (
                              <Badge variant="outline" className="text-[10px]">
                                +{prospect.collaborators.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          prospect.status === "Rejected" ? "border-red-300 text-red-700" :
                          prospect.status === "Qualified" ? "border-green-300 text-green-700" :
                          prospect.status === "Contacted" ? "border-blue-300 text-blue-700" :
                          ""
                        }`}
                      >
                        {prospect.status}
                      </Badge>
                    </div>
                    <div className="text-sm mb-3">
                      <p className="text-muted-foreground">Inquiry: <span className="font-medium text-foreground">{prospect.inquiry}</span></p>
                      <p className="text-xs text-muted-foreground mt-1">Source: {prospect.source}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Intent score: <span className="font-semibold text-violet-600 dark:text-violet-400">{prospect.intentScore}/100</span>
                      </p>
                      {prospect.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">Note: {prospect.notes}</p>
                      )}
                    </div>
                    {prospect.status !== "Rejected" && prospect.status !== "Qualified" && (
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 gap-2"
                          onClick={() => handleContactProspect(prospect)}
                        >
                          <MessageSquare className="w-3 h-3" />
                          Reply
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={() => {
                            setSelectedProspect(prospect);
                            setQualifyEstimatedValue("");
                            setQualifyAgent("Zelia AI");
                            setQualifyStatus("New");
                            setQualifyNotes("");
                            setShowQualifyProspectDialog(true);
                          }}
                        >
                          <CheckCircle className="w-3 h-3" />
                          Qualify
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          className="flex-1 gap-2"
                          onClick={() => {
                            setSelectedProspect(prospect);
                            setShowRejectProspectDialog(true);
                          }}
                        >
                          <XCircle className="w-3 h-3" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

      {/* Add Customer Dialog */}
      <Dialog open={showAddCustomerDialog} onOpenChange={setShowAddCustomerDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Enter the customer details below. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Company or Person Name"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  placeholder="+234 801 234 5678"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@company.com"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country *</Label>
                <Select value={newCustomer.country} onValueChange={(value) => setNewCustomer({ ...newCustomer, country: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nigeria">Nigeria</SelectItem>
                    <SelectItem value="Kenya">Kenya</SelectItem>
                    <SelectItem value="Ghana">Ghana</SelectItem>
                    <SelectItem value="Tanzania">Tanzania</SelectItem>
                    <SelectItem value="Uganda">Uganda</SelectItem>
                    <SelectItem value="Rwanda">Rwanda</SelectItem>
                    <SelectItem value="Côte d'Ivoire">Côte d'Ivoire</SelectItem>
                    <SelectItem value="Senegal">Senegal</SelectItem>
                    <SelectItem value="Ethiopia">Ethiopia</SelectItem>
                    <SelectItem value="South Africa">South Africa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner">Owner</Label>
                <Select value={newCustomer.owner} onValueChange={(value) => setNewCustomer({ ...newCustomer, owner: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {ownerOptions.map((owner) => (
                      <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="collaborators">Collaborators</Label>
                <Input
                  id="collaborators"
                  placeholder="Awa Mbemba, Jean Kouamé"
                  value={newCustomer.collaborators}
                  onChange={(e) => setNewCustomer({ ...newCustomer, collaborators: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="Lagos, Nairobi, Accra..."
                value={newCustomer.city}
                onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional information about the customer..."
                value={newCustomer.notes}
                onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCustomerDialog(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleAddCustomer}
            >
              Add Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={showEditCustomerDialog} onOpenChange={setShowEditCustomerDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update customer information
            </DialogDescription>
          </DialogHeader>
          {editingCustomer && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={editingCustomer.name}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone *</Label>
                  <Input
                    value={editingCustomer.phone}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editingCustomer.email || ""}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select value={editingCustomer.country} onValueChange={(value) => setEditingCustomer({ ...editingCustomer, country: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map(country => (
                        <SelectItem key={country} value={country}>{country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select value={editingCustomer.owner} onValueChange={(value) => setEditingCustomer({ ...editingCustomer, owner: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ownerOptions.map((owner) => (
                      <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Collaborators</Label>
                <Input
                  value={(editingCustomer.collaborators || []).join(", ")}
                  onChange={(e) =>
                    setEditingCustomer({
                      ...editingCustomer,
                      collaborators: e.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={editingCustomer.city || ""}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Risk Score</Label>
                <Select value={editingCustomer.riskScore} onValueChange={(value) => setEditingCustomer({ ...editingCustomer, riskScore: value as Customer["riskScore"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low Risk</SelectItem>
                    <SelectItem value="Medium">Medium Risk</SelectItem>
                    <SelectItem value="High">High Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCustomerDialog(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleEditCustomer}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the customer
              and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteCustomer}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Tag Dialog */}
      <Dialog open={showAddTagDialog} onOpenChange={setShowAddTagDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Tag</DialogTitle>
            <DialogDescription>
              Add a tag to {selectedCustomer?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tag Name</Label>
              <Input
                placeholder="e.g., VIP, Premium, etc."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Quick Select</Label>
              <div className="flex flex-wrap gap-2">
                {["VIP", "Premium", "Wholesale", "Retail", "Distributor"].map(tag => (
                  <Badge 
                    key={tag}
                    variant="outline"
                    className="cursor-pointer hover:bg-gray-100"
                    onClick={() => setNewTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTagDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTag}>
              Add Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showAddNoteDialog} onOpenChange={setShowAddNoteDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add a note for {selectedCustomer?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter your note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNoteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNote}>
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Details Dialog */}
      <Dialog open={showLeadDetailsDialog} onOpenChange={setShowLeadDetailsDialog}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>Review, update, and convert this lead.</DialogDescription>
          </DialogHeader>
          {selectedLead ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Lead</p>
                  <p className="text-lg font-semibold text-foreground">{selectedLead.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedLead.country} • {selectedLead.phone}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Owner: <span className="text-muted-foreground">{selectedLead.owner}</span> · Onboarded:{" "}
                    <span className="text-muted-foreground">{selectedLead.onboardedBy}</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleWhatsAppContact(selectedLead.phone, selectedLead.name)}
                    >
                      <MessageSquare className="h-3 w-3" />
                      WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleCopy(selectedLead.phone, "Phone")}
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Opportunity</p>
                  <p className="text-lg font-semibold text-foreground">{selectedLead.product}</p>
                  <p className="text-sm font-medium text-green-600">{selectedLead.estimatedValue}</p>
                  <p className="text-xs text-muted-foreground mt-2">Source: {selectedLead.source}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className="bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                      AI {selectedLead.aiScore}/100
                    </Badge>
                    <span className="text-xs text-muted-foreground">Last contact: {selectedLead.lastContact}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={leadStatus} onValueChange={(value) => setLeadStatus(value as Lead["status"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Qualified">Qualified</SelectItem>
                      <SelectItem value="Quoted">Quoted</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assigned Agent</Label>
                  <Select value={assignedAgent} onValueChange={setAssignedAgent}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Zelia AI">Zelia AI</SelectItem>
                      <SelectItem value="Human Agent">Human Agent</SelectItem>
                      <SelectItem value="Sales Manager">Sales Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select value={leadOwner} onValueChange={setLeadOwner}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ownerOptions.map((owner) => (
                      <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Collaborators</Label>
                <Input
                  placeholder="Awa Mbemba, Jean Kouamé"
                  value={leadCollaborators}
                  onChange={(e) => setLeadCollaborators(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Next Action</Label>
                <Input
                  placeholder="Example: Send pricing breakdown"
                  value={leadNextAction}
                  onChange={(e) => setLeadNextAction(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Add context, objections, next steps..."
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Activity Timeline</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Lead onboarded by {selectedLead.onboardedBy} ({selectedLead.source})</li>
                  <li>• Status set to {leadStatus} · Last contact {selectedLead.lastContact}</li>
                  <li>• Next action: {leadNextAction || selectedLead.nextAction}</li>
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No lead selected.</p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowLeadDetailsDialog(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              className="border-border text-foreground hover:bg-accent"
              onClick={handleSaveLeadDetails}
            >
              Save Updates
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={() => {
                setShowLeadDetailsDialog(false);
                setShowConvertLeadDialog(true);
              }}
            >
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Lead Dialog */}
      <Dialog open={showConvertLeadDialog} onOpenChange={setShowConvertLeadDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Convert Lead to Customer</DialogTitle>
            <DialogDescription>
              Convert {selectedLead?.name} to a customer?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This will create a new customer record and remove this lead from the leads list.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertLeadDialog(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-primary hover:bg-primary/90"
              onClick={handleConvertLead}
            >
              Convert to Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Qualify Prospect Dialog */}
      <Dialog open={showQualifyProspectDialog} onOpenChange={setShowQualifyProspectDialog}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Qualify Prospect</DialogTitle>
            <DialogDescription>
              Convert {selectedProspect?.name} to an active lead?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-sm text-muted-foreground">
              This will create a new lead and mark this prospect as qualified.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estimated Value</Label>
                <Input
                  placeholder="$0"
                  value={qualifyEstimatedValue}
                  onChange={(e) => setQualifyEstimatedValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Assigned Agent</Label>
                <Select value={qualifyAgent} onValueChange={setQualifyAgent}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Zelia AI">Zelia AI</SelectItem>
                    <SelectItem value="Human Agent">Human Agent</SelectItem>
                    <SelectItem value="Sales Manager">Sales Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Initial Status</Label>
                <Select value={qualifyStatus} onValueChange={(value) => setQualifyStatus(value as Lead["status"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Qualified">Qualified</SelectItem>
                    <SelectItem value="Quoted">Quoted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  placeholder="Optional notes"
                  value={qualifyNotes}
                  onChange={(e) => setQualifyNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQualifyProspectDialog(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-primary hover:bg-primary/90"
              onClick={handleQualifyProspect}
            >
              Qualify as Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Prospect Dialog */}
      <Dialog open={showRejectProspectDialog} onOpenChange={setShowRejectProspectDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Reject Prospect</DialogTitle>
            <DialogDescription>
              Why are you rejecting {selectedProspect?.name}?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectProspectDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRejectProspect}
            >
              Reject Prospect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters Sheet */}
      <Sheet open={showFiltersSheet} onOpenChange={setShowFiltersSheet}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Filter Customers</SheetTitle>
            <SheetDescription>
              Apply filters to refine your customer list
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All countries</SelectItem>
                  {countries.map(country => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Owner</Label>
              <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                <SelectTrigger>
                  <SelectValue placeholder="All owners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All owners</SelectItem>
                  {ownerOptions.map((owner) => (
                    <SelectItem key={owner} value={owner}>{owner}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Risk Score</Label>
              <Select value={selectedRiskScore} onValueChange={setSelectedRiskScore}>
                <SelectTrigger>
                  <SelectValue placeholder="All risk levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All risk levels</SelectItem>
                  <SelectItem value="Low">Low Risk</SelectItem>
                  <SelectItem value="Medium">Medium Risk</SelectItem>
                  <SelectItem value="High">High Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>WhatsApp Status</Label>
              <Select value={selectedWhatsappStatus} onValueChange={setSelectedWhatsappStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <Badge 
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (selectedTags.includes(tag)) {
                        setSelectedTags(selectedTags.filter(t => t !== tag));
                      } else {
                        setSelectedTags([...selectedTags, tag]);
                      }
                    }}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <Button 
                className="w-full"
                onClick={() => {
                  setShowFiltersSheet(false);
                  toast.success("Filters applied successfully");
                }}
              >
                Apply Filters
              </Button>
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={clearFilters}
              >
                <X className="w-4 h-4" />
                Clear All Filters
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Import Customers</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import customers in bulk
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">Drag and drop your CSV file here, or click to browse</p>
              <Button variant="outline" size="sm">
                Choose File
              </Button>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">CSV Format:</p>
              <p className="text-xs text-blue-700">Name, Phone, Email, Country, City, Tags</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white">
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
