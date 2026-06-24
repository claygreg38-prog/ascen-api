import { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { isAuthenticated, getUser } from './services/auth';
import { initBLE } from './services/ble';
import { initPushNotifications } from './services/pushNotifications';
import { initGeofencing } from './services/geofencing';
import api from './services/api';
import BottomNav from './components/BottomNav';
import HelpButton from './components/HelpButton';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import SessionScreen from './screens/SessionScreen';
import GalleryScreen from './screens/GalleryScreen';
import FamilyScreen from './screens/FamilyScreen';
import ProfileScreen from './screens/ProfileScreen';
import CoupleSessionScreen from './screens/CoupleSessionScreen';
import VaultScreen from './screens/VaultScreen';
import ShowcaseScreen from './screens/ShowcaseScreen';
import LightBridgeScreen from './screens/LightBridgeScreen';
import SubscriptionScreen from './screens/SubscriptionScreen';
import TherapyReportScreen from './screens/TherapyReportScreen';
import CurriculumScreen from './screens/CurriculumScreen';
import HealingMapScreen from './screens/HealingMapScreen';
import CrisisScreen from './screens/CrisisScreen';
import FacilitatorScreen from './screens/FacilitatorScreen';
import KitchenTableScreen from './screens/KitchenTableScreen';
import ClinicianDashboardScreen from './screens/ClinicianDashboardScreen';
import ChildBreathScreen from './screens/ChildBreathScreen';
import ChildHomeScreen from './screens/ChildHomeScreen';
import CrestViewerScreen from './screens/CrestViewerScreen';
import ChangePasswordScreen from './screens/ChangePasswordScreen';
import WearableSyncScreen from './screens/WearableSyncScreen';

// Shared features + age context for BottomNav and age-aware routing
const FeaturesContext = createContext(null);
const AgeBracketContext = createContext(null);
export function useFeatures() { return useContext(FeaturesContext); }
export function useAgeBracket() { return useContext(AgeBracketContext); }

function FeaturesProvider({ children }) {
  const [features, setFeatures] = useState(null);
  const [ageBracket, setAgeBracket] = useState(null);

  useEffect(() => {
    if (!isAuthenticated()) return;
    api.get('/api/auth/context')
      .then(res => {
        setFeatures(res.data?.features || null);
        setAgeBracket(res.data?.age_config?.bracket || 'adult');
      })
      .catch(() => { setAgeBracket('adult'); }); // Safe default — adults see everything, children restricted server-side
  }, []);

  return (
    <FeaturesContext.Provider value={features}>
      <AgeBracketContext.Provider value={ageBracket}>
        {children}
      </AgeBracketContext.Provider>
    </FeaturesContext.Provider>
  );
}

function Protected({ children, nav: showNav = true, showHelp = true }) {
  const features = useFeatures();
  if (!isAuthenticated()) return <Navigate to="/app/login" />;
  return (
    <>
      {children}
      {showNav && <BottomNav features={features} />}
      {showHelp && <HelpButton />}
    </>
  );
}

function FacilitatorOnly({ children }) {
  const features = useFeatures();
  const user = getUser();
  if (!isAuthenticated()) return <Navigate to="/app/login" />;
  if (!user || !['admin', 'clinician', 'facilitator'].includes(user.role)) return <Navigate to="/app/" />;
  return <>{children}<BottomNav features={features} /></>;
}

function AgeAwareHome() {
  const bracket = useAgeBracket();
  // null = context still loading or failed. Don't flash adult descent to a child.
  // Both HomeScreen and ChildHomeScreen handle their own loading states.
  if (bracket === null) return <HomeScreen />; // HomeScreen has its own context load + age check in handleDiveIn
  if (bracket === 'elementary' || bracket === 'middle_school') return <ChildHomeScreen />;
  return <HomeScreen />;
}

function ClinicianOnly({ children }) {
  const user = getUser();
  if (!isAuthenticated()) return <Navigate to="/app/login" />;
  if (!user || !['admin', 'clinician'].includes(user.role)) return <Navigate to="/app/" />;
  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      initBLE().catch(() => {});
      initPushNotifications().catch(() => {});
      initGeofencing().catch(() => {});
    }
  }, []);

  return (
    <BrowserRouter>
      <FeaturesProvider>
        <Routes>
          {/* Public */}
          <Route path="/app/login" element={<LoginScreen />} />
          <Route path="/app/register" element={<RegisterScreen />} />
          <Route path="/app/onboarding" element={<OnboardingScreen />} />
          <Route path="/app/change-password" element={<ChangePasswordScreen />} />

          {/* Core — with nav (age-aware home) */}
          <Route path="/app" element={<Protected><AgeAwareHome /></Protected>} />
          <Route path="/app/" element={<Protected><AgeAwareHome /></Protected>} />
          <Route path="/app/child-home" element={<Protected><ChildHomeScreen /></Protected>} />
          <Route path="/app/gallery" element={<Protected><GalleryScreen /></Protected>} />
          <Route path="/app/family" element={<Protected><FamilyScreen /></Protected>} />
          <Route path="/app/family/kitchen-table" element={<Protected nav={false} showHelp={false}><KitchenTableScreen /></Protected>} />
          <Route path="/app/family/crest" element={<Protected><CrestViewerScreen /></Protected>} />
          <Route path="/app/profile" element={<Protected><ProfileScreen /></Protected>} />

          {/* Immersive — no nav, no help */}
          <Route path="/app/wearable-sync" element={<Protected nav={false} showHelp={false}><WearableSyncScreen /></Protected>} />
          <Route path="/app/session" element={<Protected nav={false} showHelp={false}><SessionScreen /></Protected>} />
          <Route path="/app/couple" element={<Protected nav={false} showHelp={false}><CoupleSessionScreen /></Protected>} />
          <Route path="/app/child-breathe" element={<Protected nav={false} showHelp={false}><ChildBreathScreen /></Protected>} />

          {/* Feature screens — with nav */}
          <Route path="/app/vault" element={<Protected><VaultScreen /></Protected>} />
          <Route path="/app/showcase" element={<Protected><ShowcaseScreen /></Protected>} />
          <Route path="/app/lightbridge" element={<Protected><LightBridgeScreen /></Protected>} />
          <Route path="/app/subscription" element={<Protected><SubscriptionScreen /></Protected>} />
          <Route path="/app/therapy-reports" element={<Protected><TherapyReportScreen /></Protected>} />
          <Route path="/app/curriculum" element={<Protected><CurriculumScreen /></Protected>} />
          <Route path="/app/healing-map" element={<Protected><HealingMapScreen /></Protected>} />
          <Route path="/app/crisis" element={<Protected nav={false} showHelp={false}><CrisisScreen /></Protected>} />

          {/* Clinician — role-gated, immersive (no nav, no help) */}
          <Route path="/app/clinician/session/:id" element={<ClinicianOnly><ClinicianDashboardScreen /></ClinicianOnly>} />

          {/* Facilitator — role-gated */}
          <Route path="/app/facilitator" element={<FacilitatorOnly><FacilitatorScreen /></FacilitatorOnly>} />

          <Route path="*" element={<Navigate to="/app/" />} />
        </Routes>
      </FeaturesProvider>
    </BrowserRouter>
  );
}
