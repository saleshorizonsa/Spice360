import { useCallback, useState } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import LoginScreen from '@/components/LoginScreen';
import ForgotPasswordScreen from '@/components/ForgotPasswordScreen';
import ResetPasswordScreen from '@/components/ResetPasswordScreen';
import TenantOnboardingWizard, { useTenantReadiness } from '@/components/onboarding/TenantOnboardingWizard';
import PublicLandingPage from '@/components/PublicLandingPage';
import AuthConfirmPage from '@/components/AuthConfirmPage';
import EmailVerificationPendingPage from '@/components/EmailVerificationPendingPage';
import SubscriptionGatePage from '@/components/SubscriptionGatePage';
import { defaultSubscriptionPlanId, storeSignupPlan } from '@/lib/subscriptionPlans';
import { isAuthCallbackPath } from '@/lib/authRedirect';
import { canAccessPathForEmailVerification } from '@/lib/emailVerificationGate';
import { useQuery } from '@tanstack/react-query';
import { matrixSales } from '@/api/matrixSalesClient';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const BLOCKED_SUBSCRIPTION_STATUSES = new Set(['expired', 'cancelled', 'past_due', 'suspended']);

const AuthenticatedApp = () => {
  const { user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, authProvider } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const hasEnteredApp = sessionStorage.getItem('horizon_entered_app') === 'true';
  const readiness = useTenantReadiness();
  const [authScreen, setAuthScreen] = useState('landing');
  const [selectedPlan, setSelectedPlan] = useState(defaultSubscriptionPlanId);

  // Fetch active subscription for the current tenant (only when authenticated and not platform owner)
  const { data: subscription } = useQuery({
    queryKey: ['active-subscription', user?.id],
    queryFn: async () => {
      const orgId = user?.organization_id || user?.tenant_id;
      if (!orgId) return null;
      const subs = await matrixSales.entities.Subscription.filter({ organization_id: orgId });
      return Array.isArray(subs) && subs.length > 0 ? subs[0] : null;
    },
    enabled: isAuthenticated && !user?.is_platform_owner,
    staleTime: 60_000,
  });

  const enterApp = useCallback(() => {
    sessionStorage.setItem('horizon_entered_app', 'true');
    navigate(`/${mainPageKey}`, { replace: true });
  }, [navigate]);

  const backToLogin = useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  const openSignupForPlan = (planId) => {
    const nextPlan = planId || defaultSubscriptionPlanId;
    setSelectedPlan(nextPlan);
    storeSignupPlan(nextPlan);
    setAuthScreen('signup');
  };

  const openLogin = () => setAuthScreen('login');
  const isAuthCallback = isAuthCallbackPath(location.pathname);
  const isEmailVerificationPendingPath = location.pathname === '/email-verification-pending';
  const isResetPasswordPath = location.pathname === '/reset-password';

  const renderAuthEntry = () => {
    if (authScreen === 'landing') {
      return <PublicLandingPage onLogin={openLogin} onSelectPlan={openSignupForPlan} />;
    }
    if (authScreen === 'forgot') {
      return <ForgotPasswordScreen onBack={() => setAuthScreen('login')} />;
    }

    return (
      <LoginScreen
        onLogin={navigateToLogin}
        onAuthSuccess={enterApp}
        onSignupPending={(email) => navigate(`/email-verification-pending?email=${encodeURIComponent(email)}`, { replace: true })}
        selectedPlan={selectedPlan}
        initialMode={authScreen === 'signup' ? 'signup' : 'signin'}
        onBackToLanding={() => setAuthScreen('landing')}
        onForgotPassword={() => setAuthScreen('forgot')}
      />
    );
  };

  if (isAuthCallback) {
    return <AuthConfirmPage onConfirmed={() => navigate('/', { replace: true })} onBackToLogin={backToLogin} />;
  }

  if (isResetPasswordPath) {
    const token = new URLSearchParams(location.search).get('token') || '';
    return <ResetPasswordScreen token={token} onSuccess={() => { navigate('/', { replace: true }); setAuthScreen('login'); }} />;
  }

  if (isEmailVerificationPendingPath) {
    return <EmailVerificationPendingPage onBackToLogin={backToLogin} />;
  }

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return renderAuthEntry();
    }
  }

  if (!isAuthenticated) {
    return renderAuthEntry();
  }

  if (authProvider === 'supabase' && !user?.is_platform_owner && !user?.email_verified) {
    if (!canAccessPathForEmailVerification(location.pathname, user)) {
      return <Navigate to="/email-verification-pending" replace />;
    }
    return <EmailVerificationPendingPage onBackToLogin={backToLogin} />;
  }

  if (authProvider === 'supabase' && !user?.is_platform_owner && !readiness.ready) {
    return <TenantOnboardingWizard onComplete={enterApp} />;
  }

  // Block access for non-owners with expired/cancelled/suspended subscriptions
  if (isAuthenticated && !user?.is_platform_owner && subscription) {
    const status = subscription.status;
    const trialEnded = status === 'trialing' && subscription.trial_end_date && new Date(subscription.trial_end_date) < new Date();
    if (trialEnded) {
      return <SubscriptionGatePage subscriptionStatus="expired" />;
    }
    if (BLOCKED_SUBSCRIPTION_STATUSES.has(status)) {
      return <SubscriptionGatePage subscriptionStatus={status} />;
    }
  }

  if (location.pathname === '/' && !hasEnteredApp) {
    return renderAuthEntry();
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
