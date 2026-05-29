/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AIAssistant from './pages/AIAssistant';
import AccountLedger from './pages/AccountLedger';
import AdminCenter from './pages/AdminCenter';
import Analytics from './pages/Analytics';
import ApprovalWorkflows from './pages/ApprovalWorkflows';
import Approvals from './pages/Approvals';
import AssetLifecycle from './pages/AssetLifecycle';
import AssetScanner from './pages/AssetScanner';
import AssetVerification from './pages/AssetVerification';
import BudgetManagement from './pages/BudgetManagement';
import ChartOfAccounts from './pages/ChartOfAccounts';
import CoilManagement from './pages/CoilManagement';
import ComplianceReports from './pages/ComplianceReports';
import Costing from './pages/Costing';
import Dashboard from './pages/Dashboard';
import DemandPlanning from './pages/DemandPlanning';
import DepreciationReports from './pages/DepreciationReports';
import Finance from './pages/Finance';
import FinancialReports from './pages/FinancialReports';
import FixedAssets from './pages/FixedAssets';
import HR from './pages/HR';
import HRReports from './pages/HRReports';
import ITSecurityReports from './pages/ITSecurityReports';
import Integrations from './pages/Integrations';
import Inventory from './pages/Inventory';
import InventoryReports from './pages/InventoryReports';
import JournalEntry from './pages/JournalEntry';
import KPIDashboard from './pages/KPIDashboard';
import POS from './pages/POS';
import ManufacturingReports from './pages/ManufacturingReports';
import MasterDataManagement from './pages/MasterDataManagement';
import MobileMenu from './pages/MobileMenu';
import Notifications from './pages/Notifications';
import OwnerDashboard from './pages/OwnerDashboard';
import Production from './pages/Production';
import Projects from './pages/Projects';
import Purchasing from './pages/Purchasing';
import Quality from './pages/Quality';
import QualityMaintenanceReports from './pages/QualityMaintenanceReports';
import Reports from './pages/Reports';
import Sales from './pages/Sales';
import SalesReports from './pages/SalesReports';
import SupplyChain from './pages/SupplyChain';
import TreasuryManagement from './pages/TreasuryManagement';
import ZATCA from './pages/ZATCA';
import ZakatManagement from './pages/ZakatManagement';
import Profile from './pages/Profile';
import OrganizationSettings from './pages/OrganizationSettings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIAssistant": AIAssistant,
    "AccountLedger": AccountLedger,
    "AdminCenter": AdminCenter,
    "Analytics": Analytics,
    "ApprovalWorkflows": ApprovalWorkflows,
    "Approvals": Approvals,
    "AssetLifecycle": AssetLifecycle,
    "AssetScanner": AssetScanner,
    "AssetVerification": AssetVerification,
    "BudgetManagement": BudgetManagement,
    "ChartOfAccounts": ChartOfAccounts,
    "CoilManagement": CoilManagement,
    "ComplianceReports": ComplianceReports,
    "Costing": Costing,
    "Dashboard": Dashboard,
    "DemandPlanning": DemandPlanning,
    "DepreciationReports": DepreciationReports,
    "Finance": Finance,
    "FinancialReports": FinancialReports,
    "FixedAssets": FixedAssets,
    "HR": HR,
    "HRReports": HRReports,
    "ITSecurityReports": ITSecurityReports,
    "Integrations": Integrations,
    "Inventory": Inventory,
    "InventoryReports": InventoryReports,
    "JournalEntry": JournalEntry,
    "KPIDashboard": KPIDashboard,
    "POS": POS,
    "ManufacturingReports": ManufacturingReports,
    "MasterDataManagement": MasterDataManagement,
    "MobileMenu": MobileMenu,
    "Notifications": Notifications,
    "OwnerDashboard": OwnerDashboard,
    "Production": Production,
    "Projects": Projects,
    "Purchasing": Purchasing,
    "Quality": Quality,
    "QualityMaintenanceReports": QualityMaintenanceReports,
    "Reports": Reports,
    "Sales": Sales,
    "SalesReports": SalesReports,
    "SupplyChain": SupplyChain,
    "TreasuryManagement": TreasuryManagement,
    "ZATCA": ZATCA,
    "ZakatManagement": ZakatManagement,
    "Profile": Profile,
    "OrganizationSettings": OrganizationSettings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};
