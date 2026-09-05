import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import AppInitializer from './components/AppInitializer';

// Auth
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';

// Main Layout
import AppLayout from './components/layout/AppLayout';

// Backend Config pages
import Dashboard from './pages/dashboard/Dashboard';
import ProductsPage from './pages/backend/Products';
import PriceListsPage from './pages/backend/PriceLists';
import DiscountTiersPage from './pages/backend/DiscountTiers';
import WarehousesPage from './pages/backend/Warehouses';
import SubscriptionPlansPage from './pages/backend/SubscriptionPlans';
import UpsellRulesPage from './pages/backend/UpsellRules';
import UsersPage from './pages/backend/Users';

// Sales Workspace
import QuotationsList from './pages/workspace/QuotationsList';
import QuotationBuilder from './pages/workspace/QuotationBuilder';
import PipelineKanban from './pages/workspace/PipelineKanban';
import ApprovalQueue from './pages/workspace/ApprovalQueue';
import FulfillmentPage from './pages/workspace/Fulfillment';
import SubscriptionsPage from './pages/workspace/Subscriptions';
import InvoicesPage from './pages/workspace/Invoices';

// Customer Portal
import CustomerPortal from './pages/portal/CustomerPortal';
import PortalLogin from './pages/portal/PortalLogin';

function Guard({ children, roles }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role))
    return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInitializer>
        <Toaster position="top-right"
          toastOptions={{ duration: 4000 }} />
        <Routes>
          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Customer Portal - NO AUTH GUARD */}
          <Route path="/portal/:token" element={<CustomerPortal />} />
          <Route path="/portal/login" element={<PortalLogin />} />

          {/* Main App */}
          <Route path="/" element={<Guard><AppLayout /></Guard>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />

            {/* Backend Config */}
            <Route path="products" element={
              <Guard roles={['ADMIN','SALES_MANAGER']}>
                <ProductsPage />
              </Guard>
            } />
            <Route path="price-lists" element={
              <Guard roles={['ADMIN','SALES_MANAGER']}>
                <PriceListsPage />
              </Guard>
            } />
            <Route path="discount-tiers" element={
              <Guard roles={['ADMIN','SALES_MANAGER']}>
                <DiscountTiersPage />
              </Guard>
            } />
            <Route path="warehouses" element={
              <Guard roles={['ADMIN','SALES_MANAGER','FINANCE']}>
                <WarehousesPage />
              </Guard>
            } />
            <Route path="subscription-plans" element={
              <Guard roles={['ADMIN','SALES_MANAGER']}>
                <SubscriptionPlansPage />
              </Guard>
            } />
            <Route path="upsell-rules" element={
              <Guard roles={['ADMIN','SALES_MANAGER']}>
                <UpsellRulesPage />
              </Guard>
            } />
            <Route path="users" element={
              <Guard roles={['ADMIN']}>
                <UsersPage />
              </Guard>
            } />

            {/* Sales Workspace */}
            <Route path="quotations" element={<QuotationsList />} />
            <Route path="quotations/new" element={
              <Guard roles={['SALES_REP','SALES_MANAGER','ADMIN']}>
                <QuotationBuilder />
              </Guard>
            } />
            <Route path="quotations/:id" element={<QuotationBuilder />} />
            <Route path="pipeline" element={<PipelineKanban />} />
            <Route path="approvals" element={
              <Guard roles={['SALES_MANAGER','FINANCE','ADMIN']}>
                <ApprovalQueue />
              </Guard>
            } />
            <Route path="fulfillment" element={<FulfillmentPage />} />
            <Route path="subscriptions" element={<SubscriptionsPage />} />
            <Route path="invoices" element={<InvoicesPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppInitializer>
    </BrowserRouter>
  );
}
