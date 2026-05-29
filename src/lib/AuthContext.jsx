import React, { createContext, useState, useContext, useEffect } from 'react';
import { matrixSales } from '@/api/matrixSalesClient';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import { isMatrixSalesAdminEmail, isMatrixSalesPlatformOwner } from '@/lib/adminAccess';
import { defaultSubscriptionPlanId, storeSignupPlan } from '@/lib/subscriptionPlans';
import { createSignupVerificationOptions, getAuthRedirectUrl, isAuthCallbackPath } from '@/lib/authRedirect';

const AuthContext = createContext();

// PHP API mode: VITE_API_URL is set, OR Supabase is not configured at all.
// The second condition handles cases where VITE_API_URL didn't get baked in.
const usePhpApi = !!import.meta.env.VITE_API_URL || !import.meta.env.VITE_SUPABASE_URL;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();

    if (appParams.appId || usePhpApi || !supabase) return undefined;

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(toMatrixSalesUser(session.user));
        setIsAuthenticated(true);
        setAuthError(null);

        if (!isAuthCallbackPath(window.location.pathname) && window.location.hash.includes('access_token=')) {
          window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  const checkPhpApiAuth = async () => {
    try {
      setIsLoadingAuth(true);
      if (!localStorage.getItem('auth_token')) {
        setUser(null);
        setIsAuthenticated(false);
        return;
      }
      const currentUser = await matrixSales.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch {
      localStorage.removeItem('auth_token');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      // Ensure no supabase-related errors bleed into the phpApi path
      setAuthError((prev) => (prev?.type === 'missing_supabase_config' ? null : prev));
    }
  };

  const checkAppState = async () => {
    if (!appParams.appId) {
      if (usePhpApi) {
        await checkPhpApiAuth();
        setIsLoadingPublicSettings(false);
        return;
      }

      if (!isSupabaseConfigured) {
        setAuthError({
          type: 'missing_supabase_config',
          message: 'Supabase environment variables are missing.'
        });
        setIsLoadingAuth(false);
        setIsLoadingPublicSettings(false);
        return;
      }

      await checkSupabaseAuth();
      setIsLoadingPublicSettings(false);
      return;
    }

    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const toMatrixSalesUser = (supabaseUser) => ({
    id: supabaseUser.id,
    email: supabaseUser.email,
    email_verified: Boolean(supabaseUser.email_confirmed_at || supabaseUser.confirmed_at || supabaseUser.user_metadata?.email_verified),
    full_name: supabaseUser.user_metadata?.full_name || supabaseUser.email,
    role: isMatrixSalesAdminEmail(
      supabaseUser.email,
      import.meta.env.VITE_MATRIXSALES_ADMIN_EMAILS || ''
    ) ? (isMatrixSalesPlatformOwner(supabaseUser.email) ? 'owner' : 'admin') : 'user',
    is_platform_owner: isMatrixSalesPlatformOwner(supabaseUser.email),
    assigned_roles: []
  });

  const checkSupabaseAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      if (data.session?.user) {
        setUser(toMatrixSalesUser(data.session.user));
        setIsAuthenticated(true);
        setAuthError(null);

        if (!isAuthCallbackPath(window.location.pathname) && window.location.hash.includes('access_token=')) {
          window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Supabase auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: 'auth_required',
        message: error.message || 'Authentication required'
      });
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await matrixSales.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    sessionStorage.removeItem('horizon_entered_app');

    if (usePhpApi) {
      matrixSales.auth.logout();
      return;
    }

    if (!appParams.appId && supabase) {
      await supabase.auth.signOut();
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      matrixSales.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      matrixSales.auth.logout();
    }
  };

  const navigateToLogin = () => {
    if (!appParams.appId) return;

    // Use the SDK's redirectToLogin method
    matrixSales.auth.redirectToLogin(window.location.href);
  };

  const signInWithPassword = async ({ email, password }) => {
    if (usePhpApi) {
      const data = await matrixSales.auth.login(email, password);
      setUser(data.user);
      setIsAuthenticated(true);
      setAuthError(null);
      return data;
    }

    if (!supabase) {
      throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      setUser(toMatrixSalesUser(data.user));
      setIsAuthenticated(true);
    }
    return data;
  };

  const signUpWithPassword = async ({ email, password, fullName, selectedPlan = defaultSubscriptionPlanId, termsAccepted = false }) => {
    if (usePhpApi) {
      storeSignupPlan(selectedPlan);
      return matrixSales.auth.signup(email, password, { full_name: fullName, selected_plan: selectedPlan, terms_accepted: termsAccepted });
    }

    if (!supabase) {
      throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: createSignupVerificationOptions({ fullName, selectedPlan })
    });

    if (error) throw error;
    storeSignupPlan(selectedPlan);
    if (data.user) {
      const nextUser = toMatrixSalesUser(data.user);
      if (nextUser.email_verified) {
        await supabase.auth.signOut();
        setUser(null);
        setIsAuthenticated(false);
        throw new Error('Email confirmation is disabled in Supabase. Enable Confirm email in Authentication settings before accepting new signups.');
      }
      setUser(nextUser);
      setIsAuthenticated(Boolean(data.session));
    }
    return data;
  };

  const resendVerificationEmail = async (email) => {
    if (usePhpApi) {
      const targetEmail = email || user?.email;
      if (!targetEmail) throw new Error('Email address is required.');
      return matrixSales.auth.resend(targetEmail);
    }

    if (!supabase) {
      throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }

    const targetEmail = email || user?.email;
    if (!targetEmail) throw new Error('Email address is required.');

    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email: targetEmail,
      options: { emailRedirectTo: getAuthRedirectUrl() }
    });

    if (error) throw error;
    return data;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      signInWithPassword,
      signUpWithPassword,
      resendVerificationEmail,
      authProvider: appParams.appId ? 'matrixSales' : usePhpApi ? 'phpApi' : 'supabase',
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
